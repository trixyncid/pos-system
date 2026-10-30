import uuid

from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import GroupProfile, User
from accounts.roles import CASHIER, WAITER
from accounts.services.roles import ensure_system_roles
from audit.models import AuditEvent
from catalog.models import Category, Product, ProductKind
from floor.models import Area, Table
from orders.models import OrderStatus
from outlet.models import Outlet
from payments.billing import compute, round_cash
from printing.models import JobKind, PrintJob

API = "/api/v1/"


def uid():
    return str(uuid.uuid4())


class BillingTests(TestCase):
    def test_order_of_operations_and_rounding(self):
        outlet = Outlet.load()
        outlet.service_percent = 5
        outlet.save()
        bill = compute(44_000, 4_000, outlet)
        # 40.000 → service 2.000 → PBJT 10% of 42.000 = 4.200 → 46.200, already round.
        self.assertEqual(
            (bill.discount, bill.service, bill.tax, bill.rounding, bill.total), (4_000, 2_000, 4_200, 0, 46_200)
        )
        self.assertEqual(compute(44_000, 0, outlet).as_dict()["rounding"], -20)  # 50.820 → 50.800

    def test_round_cash_halves_up(self):
        self.assertEqual(round_cash(20_350, 100), 20_400)
        self.assertEqual(round_cash(20_249, 500), 20_000)
        self.assertEqual(round_cash(20_250, 500), 20_500)
        self.assertEqual(round_cash(20_251, 1), 20_251)


class CheckoutTests(TestCase):
    def setUp(self):
        ensure_system_roles()

        def staff(name, code, pin):
            user = User.objects.create_user(None, full_name=name)
            user.set_pin(pin)
            user.save()
            user.groups.add(GroupProfile.objects.get(code=code).group)
            return user

        self.waiter = staff("Sari", WAITER, "4444")
        self.cashier = staff("Rina", CASHIER, "3333")
        self.manager = staff("Dimas", CASHIER, "2222")
        self.client = APIClient()
        self.client.force_authenticate(self.cashier)

        outlet = Outlet.load()
        outlet.service_percent = 5
        outlet.save()
        area = Area.objects.create(name="Indoor")
        self.table = Table.objects.create(area=area, label="1", x=100, y=100, width=80, height=80)
        food = Category.objects.create(name="Makanan", station="kitchen")
        self.rice = Product.objects.create(kind=ProductKind.MENU, name="Nasi goreng", category=food, price=28_000)
        self.tea = Product.objects.create(kind=ProductKind.MENU, name="Es teh", category=food, price=8_000)

        self.order_id = uid()
        self.client.post(f"{API}orders/", {"id": self.order_id, "table": str(self.table.pk)}, format="json")
        response = self.client.post(
            f"{API}orders/{self.order_id}/lines/",
            {
                "lines": [
                    {"id": uid(), "product": str(self.rice.pk)},
                    {"id": uid(), "product": str(self.tea.pk), "quantity": 2},
                ],
                "send": True,
            },
            format="json",
        )
        self.lines = [line["id"] for line in response.data["data"]["lines"]]

    def open_shift(self, cash=200_000):
        response = self.client.post(f"{API}shifts/", {"opening_cash": cash}, format="json")
        self.assertEqual(response.status_code, 201, response.content)
        return response.data["data"]

    def pay(self, **body):
        return self.client.post(f"{API}orders/{self.order_id}/payments/", {"id": uid(), **body}, format="json")

    def test_order_carries_its_bill(self):
        data = self.client.get(f"{API}orders/{self.order_id}/").data["data"]
        self.assertEqual(data["bill"]["total"], 50_800)
        self.assertEqual((data["paid"], data["remaining"]), (0, 50_800))

    def test_print_bill_then_adding_items_reopens_it(self):
        response = self.client.post(f"{API}orders/{self.order_id}/bill/")
        self.assertEqual(response.data["data"]["status"], OrderStatus.BILLED)
        job = PrintJob.objects.get(kind=JobKind.BILL)
        self.assertEqual((job.station, job.payload["bill"]["total"]), ("cashier", 50_800))
        response = self.client.post(
            f"{API}orders/{self.order_id}/lines/",
            {"lines": [{"id": uid(), "product": str(self.tea.pk)}], "send": True},
            format="json",
        )
        self.assertEqual(response.data["data"]["status"], OrderStatus.OPEN)

    def test_waiter_cannot_take_payment(self):
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.pay(tendered=100_000).status_code, 403)

    def test_discount_needs_a_manager_unless_allowed(self):
        self.client.force_authenticate(self.waiter)
        body = {"kind": "percent", "value": 10, "reason": "Pelanggan tetap"}
        response = self.client.post(f"{API}orders/{self.order_id}/discount/", body, format="json")
        self.assertEqual(response.data["code"], "approval_required")
        wrong = {**body, "approver": self.manager.pk, "approver_pin": "1111"}
        response = self.client.post(f"{API}orders/{self.order_id}/discount/", wrong, format="json")
        self.assertEqual(response.data["code"], "approval_rejected")
        approved = {**body, "approver": self.manager.pk, "approver_pin": "2222"}
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(f"{API}orders/{self.order_id}/discount/", approved, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        # 44.000 − 4.400 = 39.600 → +1.980 service → +4.158 PBJT = 45.738 → 45.700
        self.assertEqual(response.data["data"]["bill"]["discount"], 4_400)
        self.assertEqual(response.data["data"]["bill"]["total"], 45_700)
        event = AuditEvent.objects.get(action="order.discount")
        self.assertEqual(event.metadata["approved_by"], "Dimas")

    def test_discount_needs_a_reason_and_a_sane_value(self):
        self.client.force_authenticate(self.manager)
        url = f"{API}orders/{self.order_id}/discount/"
        self.assertIn("reason", self.client.post(url, {"kind": "amount", "value": 5_000}, format="json").data["errors"])
        bad = {"kind": "percent", "value": 120, "reason": "x"}
        self.assertIn("value", self.client.post(url, bad, format="json").data["errors"])

    def test_payment_needs_an_open_shift(self):
        response = self.pay(tendered=100_000)
        self.assertEqual(response.data["code"], "no_open_shift")

    def test_full_cash_payment_closes_the_order(self):
        self.open_shift()
        response = self.pay(tendered=100_000)
        self.assertEqual(response.status_code, 201, response.content)
        data = response.data["data"]
        self.assertEqual(data["status"], OrderStatus.PAID)
        self.assertEqual(data["payments"][0]["change"], 49_200)
        self.table.refresh_from_db()
        self.assertTrue(self.table.needs_cleaning)
        receipt = PrintJob.objects.get(kind=JobKind.RECEIPT)
        self.assertEqual(receipt.payload["payment"]["tendered"], 100_000)
        # Paid: no more discounts or voids.
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            f"{API}orders/{self.order_id}/discount/", {"kind": "amount", "value": 1, "reason": "x"}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_not_enough_cash_is_refused(self):
        self.open_shift()
        self.assertIn("tendered", self.pay(tendered=50_000).data["errors"])

    def test_retried_payment_is_taken_once(self):
        self.open_shift()
        body = {"id": uid(), "tendered": 100_000}
        url = f"{API}orders/{self.order_id}/payments/"
        self.client.post(url, body, format="json")
        again = self.client.post(url, body, format="json")
        self.assertEqual(len(again.data["data"]["payments"]), 1)

    def test_split_by_item_settles_exactly(self):
        self.open_shift()
        rice, tea = self.lines
        first = self.pay(tendered=50_000, line_ids=[rice]).data["data"]
        # 28.000 → service 1.400 → PBJT 2.940 = 32.340 → 32.300
        self.assertEqual(first["paid"], 32_300)
        self.assertEqual(first["status"], OrderStatus.OPEN)
        self.assertTrue(next(line for line in first["lines"] if line["id"] == rice)["paid"])
        again = self.pay(tendered=50_000, line_ids=[rice])
        self.assertIn("line_ids", again.data["errors"])
        last = self.pay(tendered=20_000, line_ids=[tea]).data["data"]
        self.assertEqual((last["paid"], last["remaining"], last["status"]), (50_800, 0, OrderStatus.PAID))

    def test_paid_items_cannot_be_voided(self):
        self.open_shift()
        rice = self.lines[0]
        self.pay(tendered=50_000, line_ids=[rice])
        self.client.force_authenticate(self.manager)
        response = self.client.post(f"{API}orders/{self.order_id}/lines/{rice}/void/", {"reason": "x"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_even_split(self):
        self.open_shift()
        self.pay(tendered=30_000, amount=25_400)
        self.assertIn("amount", self.pay(tendered=50_000, amount=30_000).data["errors"])
        data = self.pay(tendered=25_400, amount=25_400).data["data"]
        self.assertEqual(data["status"], OrderStatus.PAID)


class ShiftTests(TestCase):
    def setUp(self):
        ensure_system_roles()
        self.cashier = User.objects.create_user(None, full_name="Rina")
        self.cashier.groups.add(GroupProfile.objects.get(code=CASHIER).group)
        self.manager = User.objects.create_user(None, full_name="Dimas")
        self.manager.groups.add(GroupProfile.objects.get(code=CASHIER).group)
        self.waiter = User.objects.create_user(None, full_name="Sari")
        self.waiter.groups.add(GroupProfile.objects.get(code=WAITER).group)
        self.client = APIClient()
        self.client.force_authenticate(self.cashier)

    def test_current_is_null_without_a_shift(self):
        response = self.client.get(f"{API}shifts/current/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["data"])

    def test_one_shift_at_a_time(self):
        self.client.post(f"{API}shifts/", {"opening_cash": 100_000}, format="json")
        response = self.client.post(f"{API}shifts/", {"opening_cash": 100_000}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_waiter_cannot_see_the_drawer(self):
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.get(f"{API}shifts/current/").status_code, 403)

    def test_cash_movements_and_close_with_variance(self):
        shift = self.client.post(f"{API}shifts/", {"opening_cash": 100_000}, format="json").data["data"]
        url = f"{API}shifts/{shift['id']}/"
        # A waiter has no open_drawer; the kasir moves cash.
        body = {"kind": "out", "amount": 20_000, "reason": "Beli es batu"}
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.post(f"{url}movements/", body, format="json").status_code, 403)
        self.client.force_authenticate(self.manager)
        too_much = {"kind": "out", "amount": 500_000, "reason": "x"}
        self.assertIn("amount", self.client.post(f"{url}movements/", too_much, format="json").data["errors"])
        self.client.post(f"{url}movements/", body, format="json")
        self.client.post(f"{url}movements/", {"kind": "in", "amount": 50_000, "reason": "Modal"}, format="json")
        data = self.client.get(f"{API}shifts/current/").data["data"]
        self.assertEqual(data["totals"]["expected_cash"], 130_000)

        self.client.force_authenticate(self.cashier)
        with self.captureOnCommitCallbacks(execute=True):
            data = self.client.post(f"{url}close/", {"counted_cash": 129_000}, format="json").data["data"]
        self.assertEqual((data["expected_cash"], data["variance"]), (130_000, -1_000))
        job = PrintJob.objects.get(kind=JobKind.SHIFT)
        self.assertEqual(job.station, "cashier")
        self.assertIsNone(self.client.get(f"{API}shifts/current/").data["data"])
        self.assertTrue(AuditEvent.objects.filter(action="shift.close").exists())
