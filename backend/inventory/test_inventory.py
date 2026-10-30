import uuid
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import GroupProfile, User
from accounts.roles import CASHIER, WAITER
from accounts.services.roles import ensure_system_roles
from audit.models import AuditEvent
from catalog.models import Category, Product, ProductKind, RecipeLine, TaxCategory, Unit
from floor.models import Area, Table
from inventory.models import MovementKind, StockMovement

API = "/api/v1/"


def uid():
    return str(uuid.uuid4())


class InventoryTests(TestCase):
    def setUp(self):
        ensure_system_roles()

        def staff(name, code):
            user = User.objects.create_user(None, full_name=name)
            user.groups.add(GroupProfile.objects.get(code=code).group)
            return user

        self.waiter = staff("Sari", WAITER)
        self.manager = staff("Dimas", CASHIER)
        self.storekeeper = staff("Wati", CASHIER)
        self.client = APIClient()
        self.client.force_authenticate(self.storekeeper)

        food = Category.objects.create(name="Makanan", station="kitchen")
        snacks = Category.objects.create(name="Snack", station="none")
        self.rice_grain = Product.objects.create(
            kind=ProductKind.INGREDIENT, name="Beras", unit=Unit.GRAM, cost=15, track_stock=True, stock=5_000
        )
        self.egg = Product.objects.create(
            kind=ProductKind.INGREDIENT, name="Telur", unit=Unit.PIECE, cost=2_000, track_stock=True, stock=30
        )
        self.salt = Product.objects.create(kind=ProductKind.INGREDIENT, name="Garam", unit=Unit.GRAM)
        self.fried_rice = Product.objects.create(kind=ProductKind.MENU, name="Nasi goreng", category=food, price=28_000)
        RecipeLine.objects.create(product=self.fried_rice, ingredient=self.rice_grain, quantity=Decimal("150"))
        RecipeLine.objects.create(product=self.fried_rice, ingredient=self.egg, quantity=Decimal("1"))
        RecipeLine.objects.create(product=self.fried_rice, ingredient=self.salt, quantity=Decimal("2"))
        self.chips = Product.objects.create(
            kind=ProductKind.RETAIL,
            name="Keripik",
            category=snacks,
            price=12_000,
            cost=7_000,
            unit=Unit.PIECE,
            tax_category=TaxCategory.PPN,
            track_stock=True,
            stock=10,
            low_stock_threshold=Decimal("12"),
        )
        self.table = Table.objects.create(
            area=Area.objects.create(name="Indoor"), label="1", x=0, y=0, width=80, height=80
        )

    def refresh(self, *products):
        for product in products:
            product.refresh_from_db()

    def order(self, lines, send=True):
        self.client.force_authenticate(self.manager)
        order_id = uid()
        self.client.post(f"{API}orders/", {"id": order_id, "table": str(self.table.pk)}, format="json")
        response = self.client.post(
            f"{API}orders/{order_id}/lines/",
            {"lines": [{"id": uid(), "product": str(p.pk), "quantity": q} for p, q in lines], "send": send},
            format="json",
        )
        return order_id, response.data["data"]

    def test_sending_takes_items_and_recipe_ingredients_from_stock(self):
        _, held = self.order([(self.fried_rice, 2), (self.chips, 1)], send=False)
        self.refresh(self.rice_grain, self.chips)
        self.assertEqual(self.rice_grain.stock, 5_000)  # Held lines take nothing yet.
        self.client.post(f"{API}orders/{held['id']}/send/", {}, format="json")
        self.refresh(self.rice_grain, self.egg, self.chips, self.salt)
        self.assertEqual((self.rice_grain.stock, self.egg.stock, self.chips.stock), (4_700, 28, 9))
        self.assertEqual(self.salt.stock, 0)  # Not tracked.
        sale = StockMovement.objects.get(product=self.rice_grain)
        self.assertEqual((sale.kind, sale.quantity, sale.balance), (MovementKind.SALE, -300, 4_700))

    def test_void_returns_the_item_but_not_its_ingredients(self):
        order_id, data = self.order([(self.fried_rice, 1), (self.chips, 2)])
        for line in data["lines"]:
            self.client.post(f"{API}orders/{order_id}/lines/{line['id']}/void/", {"reason": "Batal"}, format="json")
        self.refresh(self.chips, self.egg)
        self.assertEqual((self.chips.stock, self.egg.stock), (10, 29))
        self.assertEqual(StockMovement.objects.get(kind=MovementKind.VOID).reason, "Batal")

    def test_receive_averages_the_cost_and_is_idempotent(self):
        body = {
            "id": uid(),
            "supplier": "Toko Makmur",
            "lines": [{"product": str(self.chips.pk), "quantity": "10", "unit_cost": 8_000}],
        }
        with self.captureOnCommitCallbacks(execute=True):
            first = self.client.post(f"{API}inventory/movements/receive/", body, format="json")
        self.assertEqual(first.status_code, 201, first.content)
        self.client.post(f"{API}inventory/movements/receive/", body, format="json")
        self.refresh(self.chips)
        # (10 × 7.000 + 10 × 8.000) / 20
        self.assertEqual((self.chips.stock, self.chips.cost), (20, 7_500))
        self.assertEqual(StockMovement.objects.filter(kind=MovementKind.RECEIVE).count(), 1)
        self.assertTrue(AuditEvent.objects.filter(action="stock.receive").exists())

    def test_only_tracked_items_can_be_received(self):
        body = {"id": uid(), "lines": [{"product": str(self.salt.pk), "quantity": "100", "unit_cost": 5}]}
        response = self.client.post(f"{API}inventory/movements/receive/", body, format="json")
        self.assertEqual(response.status_code, 400)

    def test_waste(self):
        body = {"product": str(self.egg.pk), "quantity": "3", "reason": "Pecah"}
        response = self.client.post(f"{API}inventory/movements/waste/", body, format="json")
        self.assertEqual(response.data["data"]["quantity"], -3)
        self.refresh(self.egg)
        self.assertEqual(self.egg.stock, 27)

    def test_count_sets_stock_and_keeps_the_difference(self):
        body = {
            "id": uid(),
            "note": "Opname akhir bulan",
            "lines": [
                {"product": str(self.egg.pk), "counted": "26"},
                {"product": str(self.chips.pk), "counted": "10"},
            ],
        }
        response = self.client.post(f"{API}inventory/movements/count/", body, format="json")
        self.assertEqual(len(response.data["data"]), 1)  # Chips were right: nothing to adjust.
        self.client.post(f"{API}inventory/movements/count/", body, format="json")
        self.refresh(self.egg)
        self.assertEqual(self.egg.stock, 26)
        self.assertEqual(StockMovement.objects.filter(kind=MovementKind.COUNT).count(), 1)

    def test_stock_list_filters_and_summary(self):
        self.egg.stock = 0
        self.egg.save()
        listing = self.client.get(f"{API}inventory/stock/").data
        self.assertEqual(listing["count"], 3)
        low = self.client.get(f"{API}inventory/stock/?status=low").data["results"]
        self.assertEqual([item["name"] for item in low], ["Keripik"])
        out = self.client.get(f"{API}inventory/stock/?status=out").data["results"]
        self.assertEqual([item["status"] for item in out], ["out"])
        summary = self.client.get(f"{API}inventory/stock/summary/").data["data"]
        # Beras 5.000 g × 15 + keripik 10 × 7.000
        self.assertEqual(summary, {"tracked": 3, "low": 1, "out": 1, "value": 145_000})

    def test_ledger_filters_by_product(self):
        self.order([(self.fried_rice, 1)])
        self.client.force_authenticate(self.storekeeper)
        rows = self.client.get(f"{API}inventory/movements/?product={self.egg.pk}").data["results"]
        self.assertEqual([(row["kind"], row["quantity"]) for row in rows], [("sale", -1)])

    def test_waiter_cannot_see_stock(self):
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.get(f"{API}inventory/stock/").status_code, 403)
