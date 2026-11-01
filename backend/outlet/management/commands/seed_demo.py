"""
`python manage.py seed_demo [--reset] [--photos DIR]`: fill an empty database
with the demo outlet from outlet/demo.py, so the app shows what the mock API
did: menu with photos, floor, staff, promos, stock, tables in service, an
open shift and thirty days of sales.
"""

import random
import uuid
from contextlib import contextmanager
from datetime import datetime, time, timedelta
from decimal import Decimal
from io import StringIO
from pathlib import Path

from django.conf import settings
from django.core.files import File
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import GroupProfile, User
from catalog.models import Category, Modifier, ModifierGroup, Product, RecipeLine
from floor.models import Area, Table
from inventory import services as inventory
from inventory.models import StockMovement
from orders.models import Channel, DiscountKind, LineStatus, Order, OrderLine, OrderStatus, OrderType
from outlet import demo
from outlet.models import Outlet
from payments.billing import _bill_for, order_discount
from payments.models import Method, Payment
from promos.models import Promo
from shifts.models import CashMovement, MovementKind, Shift

OPENING_CASH = 500_000


@contextmanager
def keep_timestamps(*models):
    """Let rows keep the created_at/updated_at we give them, so history sits in the past."""
    fields = [
        field
        for model in models
        for field in model._meta.concrete_fields
        if getattr(field, "auto_now", False) or getattr(field, "auto_now_add", False)
    ]
    saved = [(field, field.auto_now, field.auto_now_add) for field in fields]
    for field in fields:
        field.auto_now = field.auto_now_add = False
    try:
        yield
    finally:
        for field, auto_now, auto_now_add in saved:
            field.auto_now, field.auto_now_add = auto_now, auto_now_add


class Command(BaseCommand):
    help = "Fill an empty database with the demo outlet (the same data as the frontend's mock API)."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Wipe every table first (all data is lost).")
        parser.add_argument(
            "--photos",
            default=str(Path(settings.BASE_DIR).parent / "frontend" / "public" / "mock"),
            help="Folder with the mock photos (food/ and snack/). Products get no photo when it is missing.",
        )

    def handle(self, *args, reset=False, photos=None, **options):
        if reset:
            call_command("flush", interactive=False, verbosity=0)
        call_command("seed_roles", stdout=StringIO())
        if User.objects.exists() or Product.objects.exists():
            raise CommandError("The database already has data. Run with --reset to wipe it first.")
        # Seeded, so every run tells the same story; not for anything secret.
        self.random = random.Random(20_261_030)  # noqa: S311
        self.photos = Path(photos)
        self.now = timezone.localtime()
        with transaction.atomic():
            self.seed_outlet()
            self.seed_staff()
            self.seed_catalog()
            self.seed_floor()
            self.seed_promos()
            self.seed_stock()
            self.seed_history()
            self.seed_open_tables()
        self.stdout.write(
            self.style.SUCCESS(
                f"Demo outlet ready: {Product.objects.count()} products, {Order.objects.count()} orders, "
                f"{User.objects.count()} staff (password {demo.PASSWORD})."
            )
        )
        if not self.photos.is_dir():
            self.stdout.write(self.style.WARNING(f"No photos at {self.photos}; products have no image."))

    # --- Setup ---------------------------------------------------------------

    def seed_outlet(self):
        Outlet.objects.all().delete()
        Outlet.objects.create(**demo.OUTLET)

    def seed_staff(self):
        groups = {profile.code: profile.group for profile in GroupProfile.objects.select_related("group")}
        self.staff = {}
        for username, full_name, email, role, active in demo.STAFF:
            user = User.objects.create_user(
                email, demo.PASSWORD, username=username, full_name=full_name, is_active=active
            )
            user.groups.add(groups[role])
            self.staff[username] = user

    def attach_photo(self, owner, key):
        for group in ("food", "snack"):
            path = self.photos / group / f"{key}.webp"
            if path.is_file():
                with path.open("rb") as handle:
                    owner.image.save(f"{key}.webp", File(handle), save=True)
                return

    def seed_catalog(self):
        self.ingredients = {}
        order = 0
        for key, name, unit, cost in demo.INGREDIENTS:
            self.ingredients[key] = Product.objects.create(
                kind="ingredient",
                name=name,
                unit=unit,
                cost=cost,
                tax_category="none",
                track_stock=True,
                low_stock_threshold=10 if unit == "pcs" else 1_000,
                sort_order=order,
            )
            order += 1

        groups = {}
        for index, (key, name, low, high, options) in enumerate(demo.MODIFIER_GROUPS):
            group = ModifierGroup.objects.create(name=name, min_select=low, max_select=high, sort_order=index)
            Modifier.objects.bulk_create(
                Modifier(group=group, name=option, price_delta=delta, sort_order=position)
                for position, (option, delta) in enumerate(options)
            )
            groups[key] = group

        self.categories = {}
        for index, (category_name, station, items) in enumerate(demo.MENU):
            category = Category.objects.create(name=category_name, station=station, sort_order=index)
            self.categories[category_name] = category
            for item in items:
                product = Product.objects.create(
                    kind="menu",
                    name=item["name"],
                    description=item.get("description", ""),
                    category=category,
                    price=item["price"],
                    unit="portion",
                    tax_category="pbjt",
                    is_favorite=item.get("favorite", False),
                    is_available=not item.get("sold_out", False),
                    sort_order=order,
                )
                order += 1
                product.modifier_groups.set([groups[key] for key in item.get("groups", [])])
                RecipeLine.objects.bulk_create(
                    RecipeLine(product=product, ingredient=self.ingredients[key], quantity=Decimal(quantity))
                    for key, quantity in item.get("recipe", [])
                )
                self.attach_photo(product, item["key"])

        snacks = Category.objects.create(name=demo.SNACK_CATEGORY, station="none", sort_order=len(demo.MENU))
        self.categories[demo.SNACK_CATEGORY] = snacks
        for index, (key, name, price, cost) in enumerate(demo.SNACKS):
            product = Product.objects.create(
                kind="retail",
                name=name,
                category=snacks,
                price=price,
                cost=cost,
                unit="pcs",
                barcode=f"899{1_000_000_000 + index * 7_919:010d}",
                sku=f"SB-{index + 1:03d}",
                tax_category="ppn",
                track_stock=True,
                low_stock_threshold=6,
                sort_order=order,
            )
            order += 1
            self.attach_photo(product, key)

        self.products = {
            product.name: product for product in Product.objects.prefetch_related("modifier_groups__options")
        }

    def seed_floor(self):
        self.tables = {}
        for index, (name, tables) in enumerate(demo.FLOOR):
            area = Area.objects.create(name=name, sort_order=index)
            for label, shape, x, y, width, height, seats, rotation in tables:
                self.tables[label] = Table.objects.create(
                    area=area,
                    label=label,
                    shape=shape,
                    x=x,
                    y=y,
                    width=width,
                    height=height,
                    capacity=seats,
                    rotation=rotation,
                )

    def seed_promos(self):
        for spec in demo.PROMOS:
            spec = dict(spec)
            products = spec.pop("products", [])
            categories = spec.pop("categories", [])
            for field in ("starts_at", "ends_at"):
                if field in spec:
                    spec[field] = time.fromisoformat(spec[field])
            promo = Promo.objects.create(**spec)
            promo.products.set([self.products[name] for name in products])
            promo.categories.set([self.categories[name] for name in categories])

    # --- Stock ---------------------------------------------------------------

    def day_at(self, days_ago: int, hour: int, minute: int = 0) -> datetime:
        day = self.now.date() - timedelta(days=days_ago)
        return timezone.make_aware(datetime.combine(day, time(hour, minute)))

    def seed_stock(self):
        """A delivery two days ago: most items comfortably stocked, every seventh low and every eleventh out."""
        wati, sari = self.staff["wati"], self.staff["sari"]
        tracked = list(Product.objects.filter(track_stock=True).order_by("sort_order"))
        lines, used = [], []
        for index, product in enumerate(tracked):
            threshold = product.low_stock_threshold or Decimal(5)
            if index % 11 == 3:
                target = Decimal(0)
            elif index % 7 == 2:
                target = (threshold * Decimal("0.6")).quantize(Decimal(1))
            else:
                target = (threshold * (2 + index % 5)).quantize(Decimal(1))
            half = (threshold * Decimal("0.5")).quantize(Decimal(1))
            lines.append({"product": product, "quantity": target + half, "unit_cost": product.cost})
            used.append((product, half))
        start = timezone.now()
        inventory.receive(user=wati, reference=uuid.uuid4(), lines=lines, supplier="Toko Sumber Rejeki")
        StockMovement.objects.filter(created_at__gte=start).update(created_at=self.day_at(2, 9))

        start = timezone.now()
        for product, quantity in used:
            if quantity:
                product.refresh_from_db()
                inventory._record(product, -quantity, "sale", sari)
        StockMovement.objects.filter(created_at__gte=start).update(created_at=self.day_at(1, 13))

        start = timezone.now()
        inventory.waste(
            user=wati, product=self.ingredients["telur"], quantity=Decimal(4), reason="Pecah saat dibongkar"
        )
        StockMovement.objects.filter(created_at__gte=start).update(created_at=self.day_at(1, 10))

    # --- Sales ---------------------------------------------------------------

    def pick(self, items):
        return items[self.random.randrange(len(items))]

    def between(self, low, high):
        return self.random.randint(low, high)

    def line_for(self, order, product, quantity, at, user, modifiers=(), status=LineStatus.SENT):
        picked = []
        for name in modifiers:
            option = next(
                option
                for group in product.modifier_groups.all()
                for option in group.options.all()
                if option.name == name
            )
            picked.append({"group": option.group.name, "name": option.name, "price_delta": option.price_delta})
        return OrderLine(
            id=uuid.uuid4(),
            order=order,
            product=product,
            name=product.name,
            unit_price=product.price + sum(item["price_delta"] for item in picked),
            quantity=quantity,
            modifiers=picked,
            station=product.category.station if product.category else "none",
            tax_category=product.tax_category,
            status=status,
            added_by=user,
            sent_at=at if status == LineStatus.SENT else None,
            created_at=at,
            updated_at=at,
        )

    def seed_history(self):
        """Thirty days of paid orders up to now, Monday to Saturday: breakfast and lunch rushes, a busier Saturday."""
        menu = [p for p in self.products.values() if p.kind == "menu" and p.is_available]
        drinks = [p for p in menu if p.category.name.startswith("Minuman")]
        food = [p for p in menu if p not in drinks]
        retail = [p for p in self.products.values() if p.kind == "retail"]
        waiters = [self.staff["sari"], self.staff["agus"]]
        manager, cashier = self.staff["dimas"], self.staff["budi"]
        outlet = Outlet.load()
        orders, lines, payments, shifts, shift_days = [], [], [], [], []

        with keep_timestamps(Order, OrderLine, Payment, Shift, CashMovement):
            for days_ago in range(30, -1, -1):
                day = self.day_at(days_ago, 0).date()
                # Closed on Sundays. Today always gets its open shift, so checkout works in the demo.
                if day.weekday() == 6 and days_ago:
                    continue
                opened = self.day_at(days_ago, demo.OPENS - 1, 30)
                if days_ago == 0:
                    opened = min(opened, self.now - timedelta(minutes=30))
                shift = Shift(
                    id=uuid.uuid4(),
                    opened_by=cashier,
                    opening_cash=OPENING_CASH,
                    created_at=opened,
                    updated_at=opened,
                )
                shifts.append(shift)
                shift_days.append(days_ago)
                weekend = day.weekday() >= 5
                number = 0

                def sale(channel, closed, guests, items, waiter, discount=None, void=False, shift=shift):
                    nonlocal number
                    number += 1
                    created = (
                        closed - timedelta(minutes=self.between(35, 80)) if channel == Channel.RESTAURANT else closed
                    )
                    order = Order(
                        id=uuid.uuid4(),
                        number=number,
                        channel=channel,
                        type=OrderType.DINE_IN if channel == Channel.RESTAURANT else OrderType.TAKEAWAY,
                        table_label=str(self.between(1, 17)) if channel == Channel.RESTAURANT else "",
                        guests=guests,
                        status=OrderStatus.PAID,
                        opened_by=waiter,
                        closed_at=closed,
                        created_at=created,
                        updated_at=closed,
                    )
                    order_lines = [
                        self.line_for(order, product, quantity, created, waiter) for product, quantity in items
                    ]
                    if void:
                        voided = order_lines[0]
                        voided.status = LineStatus.VOID
                        voided.voided_at = created + timedelta(minutes=10)
                        voided.voided_by = manager
                        voided.void_reason = self.pick(["Salah input", "Tamu batal", "Terlalu lama"])
                    if discount:
                        order.discount_kind = DiscountKind.PERCENT
                        order.discount_value = discount
                        order.discount_reason = self.pick(["Pelanggan tetap", "Promo", "Komplain"])
                        order.discount_by = manager
                    live = [line for line in order_lines if line.status != LineStatus.VOID]
                    bill = _bill_for(order, live, order_discount(order, live), outlet)
                    qris = self.random.random() < 0.3
                    tendered = bill.total if qris else -(-bill.total // 50_000) * 50_000
                    payments.append(
                        Payment(
                            id=uuid.uuid4(),
                            order=order,
                            shift=shift,
                            method=Method.QRIS if qris else Method.CASH,
                            amount=bill.total,
                            tendered=tendered,
                            change=tendered - bill.total,
                            received_by=cashier,
                            created_at=closed,
                            updated_at=closed,
                        )
                    )
                    orders.append(order)
                    lines.extend(order_lines)

                for offset, weight in enumerate(demo.RESTAURANT_CURVE):
                    count = round(weight * (1.4 if weekend else 1) * (0.7 + self.random.random() * 0.6))
                    for _ in range(count):
                        closed = self.day_at(days_ago, demo.OPENS + offset, self.between(0, 59))
                        if closed > self.now:
                            continue
                        guests = self.between(1, 6)
                        items = []
                        for _guest in range(guests):
                            items.append((self.pick(food), 1))
                            if self.random.random() < 0.85:
                                items.append((self.pick(drinks), 1))
                        discount = self.pick([5, 10, 15]) if self.random.random() < 0.06 else None
                        sale(
                            Channel.RESTAURANT,
                            closed,
                            guests,
                            items,
                            self.pick(waiters),
                            discount=discount,
                            void=self.random.random() < 0.05,
                        )

                for hour in range(demo.OPENS, demo.CLOSES):
                    for _ in range(self.between(0, 4 if 13 <= hour <= 15 else 2)):
                        closed = self.day_at(days_ago, hour, self.between(0, 59))
                        if closed > self.now:
                            continue
                        items = [(self.pick(retail), self.between(1, 2)) for _item in range(self.between(1, 3))]
                        sale(Channel.SNACKBAR, closed, 1, items, cashier)

            Shift.objects.bulk_create(shifts)
            Order.objects.bulk_create(orders, batch_size=500)
            OrderLine.objects.bulk_create(lines, batch_size=1_000)
            Payment.objects.bulk_create(payments, batch_size=1_000)

            today = shifts[-1]
            ice = today.created_at + (self.now - today.created_at) / 2
            CashMovement.objects.create(
                shift=today,
                kind=MovementKind.OUT,
                amount=45_000,
                reason="Beli es batu",
                by=manager,
                created_at=ice,
                updated_at=ice,
            )

            # Close every past shift half an hour after closing, with a small, realistic variance.
            for days_ago, shift in zip(shift_days[:-1], shifts[:-1], strict=True):
                expected = shift.totals()["expected_cash"]
                shift.closed_at = self.day_at(days_ago, demo.CLOSES, 30)
                shift.closed_by = cashier
                shift.expected_cash = expected
                shift.counted_cash = expected + self.pick([0, 0, 0, -2_000, 1_000])
                shift.updated_at = shift.closed_at
            Shift.objects.bulk_update(
                shifts[:-1], ["closed_at", "closed_by", "expected_cash", "counted_cash", "updated_at"]
            )

    def seed_open_tables(self):
        numbers = Order.objects.filter(created_at__date=self.now.date()).count()
        with keep_timestamps(Order, OrderLine):
            for label, minutes, guests, username, status, items in demo.OPEN_TABLES:
                numbers += 1
                seated = self.now - timedelta(minutes=minutes)
                waiter = self.staff[username]
                order = Order.objects.create(
                    number=numbers,
                    table=self.tables[label],
                    table_label=label,
                    guests=guests,
                    status=status,
                    opened_by=waiter,
                    billed_at=self.now - timedelta(minutes=3) if status == OrderStatus.BILLED else None,
                    created_at=seated,
                    updated_at=seated,
                )
                OrderLine.objects.bulk_create(
                    self.line_for(
                        order,
                        self.products[name],
                        quantity,
                        seated + timedelta(minutes=min(4, minutes)),
                        waiter,
                        modifiers=modifiers,
                        status=LineStatus.HELD if held else LineStatus.SENT,
                    )
                    for name, quantity, modifiers, held in items
                )
