import itertools
from datetime import datetime, time, timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import GroupProfile, User
from accounts.roles import CASHIER, MANAGER
from accounts.services.roles import ensure_system_roles
from audit.services import emit
from catalog.models import Category, Product, ProductKind, RecipeLine, TaxCategory, Unit
from floor.models import Area, Table
from orders.models import Channel, LineStatus, Order, OrderLine, OrderStatus
from outlet.models import Outlet

API = "/api/v1/"
numbers = itertools.count(1)


class ReportTests(TestCase):
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
        food = Category.objects.create(name="Makanan", station="kitchen")
        rice = Product.objects.create(kind=ProductKind.INGREDIENT, name="Beras", unit=Unit.GRAM, cost=15)
        self.fried_rice = Product.objects.create(kind=ProductKind.MENU, name="Nasi goreng", category=food, price=30_000)
        RecipeLine.objects.create(product=self.fried_rice, ingredient=rice, quantity=Decimal("200"))  # Rp3.000
        self.chips = Product.objects.create(
            kind=ProductKind.RETAIL, name="Keripik", price=10_000, cost=6_000, tax_category=TaxCategory.PPN
        )
        area = Area.objects.create(name="Indoor")
        self.tables = [
            Table.objects.create(area=area, label=str(n), x=0, y=0, width=80, height=80) for n in range(1, 5)
        ]
        self.today = timezone.localdate()

    def paid(self, lines, *, day=None, hour=12, channel=Channel.RESTAURANT, guests=2, table=True, **extra):
        closed = timezone.make_aware(datetime.combine(day or self.today, time(hour, 15)))
        order = Order.objects.create(
            number=next(numbers),
            channel=channel,
            table_label="1" if table else "",
            guests=guests,
            status=OrderStatus.PAID,
            opened_by=self.manager,
            closed_at=closed,
            **extra,
        )
        for product, quantity, status in lines:
            OrderLine.objects.create(
                order=order,
                product=product,
                name=product.name,
                unit_price=product.price,
                quantity=quantity,
                station="kitchen",
                status=status,
                tax_category=product.tax_category,
                added_by=self.manager,
                voided_at=closed if status == LineStatus.VOID else None,
                voided_by=self.manager if status == LineStatus.VOID else None,
            )
        return order

    def test_dashboard_figures(self):
        sent, void = LineStatus.SENT, LineStatus.VOID
        # 2 × nasi goreng: 60.000 + PBJT 6.000 = 66.000, cost 6.000.
        self.paid([(self.fried_rice, 2, sent), (self.chips, 1, void)], hour=12, guests=3)
        # Snack bar: keripik 10.000, no PBJT on retail, cost 6.000.
        self.paid([(self.chips, 1, sent)], hour=19, channel=Channel.SNACKBAR, guests=1, table=False)
        # 10% discount approved by the manager: 30.000 − 3.000 = 27.000 + 2.700.
        self.paid(
            [(self.fried_rice, 1, sent)],
            hour=19,
            discount_kind="percent",
            discount_value=10,
            discount_approved_by=self.manager,
        )
        self.paid([(self.fried_rice, 1, sent)], day=self.today - timedelta(days=1), hour=0)  # 33.000 yesterday
        Order.objects.create(number=99, opened_by=self.manager, status=OrderStatus.OPEN)  # Not paid: not counted.

        data = self.client.get(f"{API}reports/dashboard/").data["data"]
        self.assertEqual((data["orders"], data["sales"], data["covers"]), (3, 66_000 + 10_000 + 29_700, 5))
        self.assertEqual(data["net"], 60_000 + 10_000 + 27_000)
        # Cost: 6.000 + 6.000 + 3.000 = 15.000 of 97.000 net.
        self.assertEqual((data["cost"], data["food_cost_percent"]), (15_000, 15.5))
        self.assertEqual(data["hourly"][12], 66_000)
        self.assertEqual(data["hourly"][19], 39_700)
        self.assertEqual(data["channels"]["snackbar"]["sales"], 10_000)
        self.assertEqual(data["yesterday"]["sales"], 33_000)
        self.assertEqual(data["top_items"][0], {"name": "Nasi goreng", "quantity": 3, "revenue": 90_000})
        self.assertEqual(data["voids"], [{"name": "Dimas", "count": 1, "amount": 10_000}])
        self.assertEqual(data["discounts"], [{"name": "Dimas", "count": 1, "amount": 3_000}])
        self.assertEqual(data["table_turns"], 0.5)  # 2 table orders over 4 tables.

    def test_sales_and_items_reports(self):
        sent = LineStatus.SENT
        self.paid([(self.fried_rice, 2, sent)], day=self.today - timedelta(days=2))
        self.paid([(self.chips, 3, sent)], channel=Channel.SNACKBAR, table=False)
        rows = self.client.get(f"{API}reports/sales/").data["data"]["rows"]
        self.assertEqual(len(rows), 7)
        by_day = {row["date"]: row for row in rows}
        self.assertEqual(by_day[str(self.today)]["sales"], 30_000)
        self.assertEqual(by_day[str(self.today - timedelta(days=2))]["sales"], 66_000)
        self.assertEqual(by_day[str(self.today - timedelta(days=1))]["orders"], 0)

        items = self.client.get(f"{API}reports/items/").data["data"]["rows"]
        self.assertEqual(
            [(i["name"], i["quantity"], i["revenue"], i["cost"], i["margin"]) for i in items],
            [("Nasi goreng", 2, 60_000, 6_000, 54_000), ("Keripik", 3, 30_000, 18_000, 12_000)],
        )
        self.assertEqual(items[1]["channel_snackbar"], 3)

    def test_items_without_a_recipe_have_no_cost(self):
        soup = Product.objects.create(kind=ProductKind.MENU, name="Sop", price=20_000)
        self.paid([(soup, 1, LineStatus.SENT)])
        row = self.client.get(f"{API}reports/items/").data["data"]["rows"][0]
        self.assertEqual((row["cost"], row["margin"]), (None, None))

    def test_range_is_validated(self):
        bad = self.client.get(f"{API}reports/sales/?from=2026-10-30&to=2026-10-01")
        self.assertIn("from", bad.data["errors"])
        too_long = self.client.get(f"{API}reports/sales/?from=2026-01-01&to=2026-10-01")
        self.assertIn("from", too_long.data["errors"])
        self.assertIn("date", self.client.get(f"{API}reports/dashboard/?date=kemarin").data["errors"])

    def test_cashier_sees_no_reports(self):
        self.client.force_authenticate(self.cashier)
        self.assertEqual(self.client.get(f"{API}reports/dashboard/").status_code, 403)
        self.assertEqual(self.client.get(f"{API}reports/sales/").status_code, 403)
        self.assertEqual(self.client.get(f"{API}audit/events/").status_code, 403)

    def test_audit_log_filters(self):
        with self.captureOnCommitCallbacks(execute=True):
            emit(None, "order.void_item", actor=self.manager, target_label="#3 · Nasi goreng")
            emit(None, "shift.close", actor=self.cashier)
        events = self.client.get(f"{API}audit/events/").data
        self.assertEqual(events["count"], 2)
        voids = self.client.get(f"{API}audit/events/?action=order.").data["results"]
        self.assertEqual([e["action"] for e in voids], ["order.void_item"])
        found = self.client.get(f"{API}audit/events/?search=nasi").data["results"]
        self.assertEqual(len(found), 1)
        today = self.client.get(f"{API}audit/events/?date={self.today}").data
        self.assertEqual(today["count"], 2)

    def test_today_is_compared_with_the_same_hours_yesterday(self):
        yesterday = self.today - timedelta(days=1)
        self.paid([(self.fried_rice, 1, LineStatus.SENT)], day=yesterday, hour=0)
        self.paid([(self.fried_rice, 1, LineStatus.SENT)], day=yesterday, hour=23)
        now = timezone.localtime()
        data = self.client.get(f"{API}reports/dashboard/").data["data"]
        expected = 33_000 if now.hour < 23 or now.minute < 15 else 66_000
        self.assertTrue(data["yesterday"]["partial"])
        self.assertEqual(data["yesterday"]["sales"], expected)
        past = self.client.get(f"{API}reports/dashboard/?date={yesterday}").data["data"]
        self.assertEqual(past["sales"], 66_000)
        self.assertFalse(past["last_week"]["partial"])
