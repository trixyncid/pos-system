import uuid
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import GroupProfile, User
from accounts.roles import CASHIER, WAITER
from accounts.services.roles import ensure_system_roles
from audit.models import AuditEvent
from catalog.models import Category, Product, ProductKind, TaxCategory
from floor.models import Area, Table
from inventory.models import MovementKind, StockMovement
from orders.models import OrderStatus
from outlet.models import Outlet
from payments.models import Refund
from printing.models import JobKind, PrintJob
from shifts.models import Shift

API = "/api/v1/"


def uid():
    return str(uuid.uuid4())


class OrderHistoryTests(TestCase):
    def setUp(self):
        ensure_system_roles()

        def staff(name, code, pin):
            user = User.objects.create_user(None, full_name=name)
            user.set_pin(pin)
            user.save()
            user.groups.add(GroupProfile.objects.get(code=code).group)
            return user

        self.cashier = staff("Budi", CASHIER, "3333")
        self.manager = staff("Dimas", CASHIER, "2222")
        self.waiter = staff("Sari", WAITER, "4444")
        self.client = APIClient()
        self.client.force_authenticate(self.cashier)

        outlet = Outlet.load()
        outlet.service_percent = 0
        outlet.pbjt_percent = 10
        outlet.cash_rounding = 1
        outlet.save()
        food = Category.objects.create(name="Makanan", station="kitchen")
        snacks = Category.objects.create(name="Snack", station="none")
        self.rice = Product.objects.create(kind=ProductKind.MENU, name="Nasi goreng", category=food, price=30_000)
        self.chips = Product.objects.create(
            kind=ProductKind.RETAIL,
            name="Keripik",
            category=snacks,
            price=10_000,
            tax_category=TaxCategory.PPN,
            track_stock=True,
            stock=10,
        )
        self.table = Table.objects.create(
            area=Area.objects.create(name="Indoor"), label="7", x=0, y=0, width=80, height=80
        )
        self.client.post(f"{API}shifts/", {"opening_cash": 100_000}, format="json")

    def table_order(self, pay=True):
        order_id = uid()
        self.client.post(f"{API}orders/", {"id": order_id, "table": str(self.table.pk)}, format="json")
        self.client.post(
            f"{API}orders/{order_id}/lines/",
            {"lines": [{"id": uid(), "product": str(self.rice.pk)}], "send": True},
            format="json",
        )
        if pay:
            self.client.post(f"{API}orders/{order_id}/payments/", {"id": uid(), "tendered": 50_000}, format="json")
        return order_id

    def sale(self, quantity=2, method="cash"):
        sale_id = uid()
        self.client.post(
            f"{API}sales/",
            {
                "id": sale_id,
                "method": method,
                "tendered": 50_000,
                "lines": [{"id": uid(), "product": str(self.chips.pk), "quantity": quantity}],
            },
            format="json",
        )
        return sale_id

    def history(self, query=""):
        # The list is a back-office page: the manager reads it.
        reader = APIClient()
        reader.force_authenticate(self.manager)
        response = reader.get(f"{API}orders/history/{query}")
        self.assertEqual(response.status_code, 200, response.content)
        return response.data

    def test_lists_both_channels_with_filters(self):
        paid = self.table_order()
        self.sale()
        rows = self.history()["results"]
        self.assertEqual([row["channel"] for row in rows], ["snackbar", "restaurant"])
        restaurant = next(row for row in rows if row["id"] == paid)
        self.assertEqual((restaurant["total"], restaurant["items"], restaurant["table_label"]), (33_000, 1, "7"))
        self.assertEqual(restaurant["summary"], "1× Nasi goreng")
        self.assertEqual(self.history("?channel=snackbar")["count"], 1)
        self.assertEqual(self.history("?status=paid")["count"], 2)
        self.assertEqual(self.history("?status=open")["count"], 0)
        self.assertEqual(self.history("?search=keripik")["count"], 1)
        self.assertEqual(self.history(f"?search=%23{restaurant['number']}")["count"], 1)
        self.assertEqual(self.history("?from=2020-01-01&to=2020-01-02")["count"], 0)

    def test_a_waiter_cannot_read_the_order_list(self):
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.get(f"{API}orders/history/").status_code, 403)

    def test_a_qris_refund_does_not_leave_the_drawer(self):
        sale_id = self.sale(quantity=1, method="qris")
        response = self.client.post(f"{API}orders/{sale_id}/refund/", {"reason": "Batal"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        refund = Refund.objects.get(order_id=sale_id)
        self.assertEqual((refund.method, refund.amount), ("qris", 10_000))
        totals = Shift.objects.get(closed_at__isnull=True).totals()
        self.assertEqual((totals["refunds"], totals["expected_cash"]), (0, 100_000))

    def test_kasir_refunds_and_it_takes_cash_and_stock_back(self):
        sale_id = self.sale(quantity=2)
        url = f"{API}orders/{sale_id}/refund/"
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.post(url, {"reason": "Salah barang"}, format="json").status_code, 403)
        # Kasir can void sent items, so a refund needs no one else's approval.
        self.client.force_authenticate(self.cashier)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(url, {"reason": "Salah barang"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        data = response.data["data"]
        self.assertEqual((data["status"], data["refund_approved_by_name"]), (OrderStatus.REFUNDED, "Budi"))
        totals = Shift.objects.get(closed_at__isnull=True).totals()
        self.assertEqual((totals["refunds"], totals["expected_cash"]), (20_000, 100_000))
        self.chips.refresh_from_db()
        self.assertEqual(self.chips.stock, Decimal(10))
        self.assertTrue(StockMovement.objects.filter(kind=MovementKind.REFUND).exists())
        slip = PrintJob.objects.filter(kind=JobKind.RECEIPT).order_by("-created_at").first()
        self.assertEqual(slip.payload["refund"], {"amount": 20_000, "reason": "Salah barang"})
        self.assertTrue(AuditEvent.objects.filter(action="order.refund").exists())
        self.assertEqual(self.history("?status=refunded")["count"], 1)
        # Refunded sales leave the reports.
        self.client.force_authenticate(self.manager)
        self.assertEqual(self.client.get(f"{API}reports/dashboard/").data["data"]["sales"], 0)

    def test_only_paid_orders_can_be_refunded(self):
        self.client.force_authenticate(self.manager)
        open_order = self.table_order(pay=False)
        response = self.client.post(f"{API}orders/{open_order}/refund/", {"reason": "x"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_reprint_receipt_and_bill(self):
        order_id = self.table_order()
        response = self.client.post(f"{API}orders/{order_id}/reprint/", {"kind": "receipt"}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        copy = PrintJob.objects.filter(kind=JobKind.RECEIPT).order_by("-created_at").first()
        self.assertTrue(copy.payload["reprint"])
        unpaid = self.sale_free_table_order()
        refused = self.client.post(f"{API}orders/{unpaid}/reprint/", {"kind": "receipt"}, format="json")
        self.assertIn("kind", refused.data["errors"])
        self.client.force_authenticate(self.waiter)
        self.assertEqual(
            self.client.post(f"{API}orders/{order_id}/reprint/", {"kind": "bill"}, format="json").status_code, 403
        )

    def sale_free_table_order(self):
        other = Table.objects.create(area=self.table.area, label="8", x=0, y=0, width=80, height=80)
        order_id = uid()
        self.client.post(f"{API}orders/", {"id": order_id, "table": str(other.pk)}, format="json")
        self.client.post(
            f"{API}orders/{order_id}/lines/",
            {"lines": [{"id": uid(), "product": str(self.rice.pk)}], "send": True},
            format="json",
        )
        return order_id
