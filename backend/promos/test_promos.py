import uuid
from datetime import date, datetime, time
from types import SimpleNamespace

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import GroupProfile, User
from accounts.roles import CASHIER, MANAGER
from accounts.services.roles import ensure_system_roles
from catalog.models import Category, Product, ProductKind
from floor.models import Area, Table
from outlet.models import Outlet
from printing.models import JobKind, PrintJob
from promos.models import Benefit, Promo, PromoChannel, PromoKind
from promos.services import discount, unavailable_reason

API = "/api/v1/"


def uid():
    return str(uuid.uuid4())


def at(day: date, hour: int, minute: int = 0):
    return timezone.make_aware(datetime.combine(day, time(hour, minute)))


def line(product, quantity=1, price=None):
    price = price if price is not None else product.price
    return SimpleNamespace(product=product, quantity=quantity, unit_price=price, total=price * quantity)


class PromoRuleTests(TestCase):
    def setUp(self):
        self.drinks = Category.objects.create(name="Minuman", station="bar")
        self.food = Category.objects.create(name="Makanan", station="kitchen")
        self.tea = Product.objects.create(kind=ProductKind.MENU, name="Es teh", category=self.drinks, price=8_000)
        self.coffee = Product.objects.create(kind=ProductKind.MENU, name="Kopi", category=self.drinks, price=20_000)
        self.rice = Product.objects.create(kind=ProductKind.MENU, name="Nasi", category=self.food, price=30_000)

    def promo(self, **fields):
        targets = {name: fields.pop(name, []) for name in ("products", "categories")}
        promo = Promo.objects.create(**{"name": "Promo", "kind": PromoKind.BILL, "value": 10, **fields})
        promo.products.set(targets["products"])
        promo.categories.set(targets["categories"])
        return promo

    def test_happy_hour_days_dates_and_channel(self):
        monday = date(2026, 10, 26)
        promo = self.promo(weekdays=[0, 1, 2, 3], starts_at=time(14), ends_at=time(17))
        self.assertIsNone(unavailable_reason(promo, channel="restaurant", now=at(monday, 15)))
        self.assertEqual(unavailable_reason(promo, channel="restaurant", now=at(monday, 17)), "time")
        self.assertEqual(unavailable_reason(promo, channel="restaurant", now=at(date(2026, 10, 31), 15)), "day")
        late = self.promo(starts_at=time(22), ends_at=time(2), channel=PromoChannel.SNACKBAR)
        self.assertIsNone(unavailable_reason(late, channel="snackbar", now=at(monday, 1)))
        self.assertEqual(unavailable_reason(late, channel="restaurant", now=at(monday, 23)), "channel")
        dated = self.promo(starts_on=date(2026, 11, 1), ends_on=date(2026, 11, 30))
        self.assertEqual(unavailable_reason(dated, channel="restaurant", now=at(monday, 12)), "not_started")

    def test_bill_promo_with_minimum_and_cap(self):
        promo = self.promo(value=20, min_spend=50_000, max_discount=8_000)
        self.assertEqual(discount(promo, [line(self.rice)]), 0)  # 30.000 < 50.000
        self.assertEqual(discount(promo, [line(self.rice, 2)]), 8_000)  # 20% of 60.000 = 12.000, capped
        fixed = self.promo(benefit=Benefit.AMOUNT, value=15_000)
        self.assertEqual(discount(fixed, [line(self.tea)]), 8_000)  # Never more than the bill.

    def test_items_promo_by_category_amount_and_price(self):
        percent = self.promo(kind=PromoKind.ITEMS, value=50, categories=[self.drinks])
        lines = [line(self.tea, 2), line(self.rice)]
        self.assertEqual(discount(percent, lines), 8_000)  # Half of the two teas only.
        price = self.promo(kind=PromoKind.ITEMS, benefit=Benefit.PRICE, value=15_000, products=[self.coffee])
        self.assertEqual(discount(price, [line(self.coffee, 3)]), 15_000)  # 20.000 → 15.000, three times.
        cheap = self.promo(kind=PromoKind.ITEMS, benefit=Benefit.PRICE, value=10_000, products=[self.tea])
        self.assertEqual(discount(cheap, [line(self.tea)]), 0)  # A promo price above the price is no surcharge.

    def test_buy_two_get_one_takes_the_cheapest(self):
        promo = self.promo(kind=PromoKind.BUNDLE, value=100, buy_quantity=2, get_quantity=1, categories=[self.drinks])
        # 3 coffees + 2 teas = 5 units, one group of 3: the cheapest unit (a tea) is free.
        self.assertEqual(discount(promo, [line(self.coffee, 3), line(self.tea, 2), line(self.rice)]), 8_000)
        self.assertEqual(discount(promo, [line(self.coffee, 6)]), 40_000)  # Two groups.
        self.assertEqual(discount(promo, [line(self.coffee, 2)]), 0)


class PromoApiTests(TestCase):
    def setUp(self):
        ensure_system_roles()
        self.manager = User.objects.create_user(None, full_name="Dimas")
        self.manager.groups.add(GroupProfile.objects.get(code=MANAGER).group)
        self.cashier = User.objects.create_user(None, full_name="Budi")
        self.cashier.groups.add(GroupProfile.objects.get(code=CASHIER).group)
        self.client = APIClient()
        self.client.force_authenticate(self.manager)
        outlet = Outlet.load()
        outlet.service_percent = 0
        outlet.pbjt_percent = 10
        outlet.cash_rounding = 1
        outlet.save()
        self.drinks = Category.objects.create(name="Minuman", station="bar")
        self.tea = Product.objects.create(kind=ProductKind.MENU, name="Es teh", category=self.drinks, price=10_000)
        table = Table.objects.create(area=Area.objects.create(name="In"), label="1", x=0, y=0, width=80, height=80)
        self.order_id = uid()
        self.client.post(f"{API}orders/", {"id": self.order_id, "table": str(table.pk)}, format="json")
        self.client.post(
            f"{API}orders/{self.order_id}/lines/",
            {"lines": [{"id": uid(), "product": str(self.tea.pk), "quantity": 3}], "send": True},
            format="json",
        )

    def create(self, **body):
        return self.client.post(f"{API}promos/", {"name": "Promo", "kind": "bill", "value": 10, **body}, format="json")

    def test_crud_validation_and_archive(self):
        self.assertIn("products", self.create(kind="items").data["errors"])
        self.assertIn("buy_quantity", self.create(kind="bundle", categories=[str(self.drinks.pk)]).data["errors"])
        self.assertIn("value", self.create(value=150).data["errors"])
        self.assertIn("ends_at", self.create(starts_at="14:00").data["errors"])
        created = self.create(name="Happy hour", weekdays=[3, 1, 1]).data["data"]
        self.assertEqual(created["weekdays"], [1, 3])
        self.client.delete(f"{API}promos/{created['id']}/")
        self.assertFalse(Promo.objects.get(pk=created["id"]).is_active)

    def test_cashier_cannot_set_up_promos(self):
        self.client.force_authenticate(self.cashier)
        self.assertEqual(self.create().status_code, 403)

    def test_cashier_applies_a_promo_and_it_replaces_a_manual_discount(self):
        promo = self.create(
            name="Teh gratis 1",
            kind="bundle",
            value=100,
            buy_quantity=2,
            get_quantity=1,
            categories=[str(self.drinks.pk)],
        ).data["data"]
        self.create(name="Besar", min_spend=100_000)
        self.client.post(
            f"{API}orders/{self.order_id}/discount/", {"kind": "amount", "value": 1_000, "reason": "x"}, format="json"
        )
        self.client.force_authenticate(self.cashier)
        offered = self.client.get(f"{API}orders/{self.order_id}/promos/").data["data"]
        self.assertEqual(
            [(p["name"], p["saving"], p["unavailable"]) for p in offered],
            [("Teh gratis 1", 10_000, None), ("Besar", 0, "min_spend")],
        )
        response = self.client.post(f"{API}orders/{self.order_id}/promo/", {"promo": promo["id"]}, format="json")
        data = response.data["data"]
        # 30.000 − 10.000 = 20.000 + PBJT 2.000; the manual discount is gone.
        self.assertEqual(
            (data["promo_name"], data["discount_kind"], data["bill"]["total"]), ("Teh gratis 1", "none", 22_000)
        )
        self.client.post(f"{API}orders/{self.order_id}/bill/")
        bill = PrintJob.objects.get(kind=JobKind.BILL)
        self.assertEqual(bill.payload["discount"], {"kind": "promo", "value": 0, "reason": "Teh gratis 1"})

        self.client.force_authenticate(self.manager)
        data = self.client.post(
            f"{API}orders/{self.order_id}/discount/", {"kind": "percent", "value": 10, "reason": "x"}, format="json"
        ).data["data"]
        self.assertEqual((data["promo"], data["promo_name"]), (None, ""))

    def test_a_bill_that_does_not_qualify_is_refused(self):
        made = self.create(min_spend=100_000)
        promo = made.data["data"]
        response = self.client.post(f"{API}orders/{self.order_id}/promo/", {"promo": promo["id"]}, format="json")
        self.assertIn("promo", response.data["errors"])
