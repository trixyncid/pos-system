import uuid
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import GroupProfile, User
from accounts.roles import CASHIER, WAITER
from accounts.services.roles import ensure_system_roles
from catalog.models import Category, Product, ProductKind, TaxCategory
from floor.models import Area, Table
from orders.models import Order, OrderStatus
from outlet.models import Outlet
from payments.models import Payment
from printing.models import JobKind, PrintJob

API = "/api/v1/"


def uid():
    return str(uuid.uuid4())


class CounterSaleTests(TestCase):
    def setUp(self):
        ensure_system_roles()
        self.cashier = User.objects.create_user(None, full_name="Budi")
        self.cashier.groups.add(GroupProfile.objects.get(code=CASHIER).group)
        self.waiter = User.objects.create_user(None, full_name="Sari")
        self.waiter.groups.add(GroupProfile.objects.get(code=WAITER).group)
        self.client = APIClient()
        self.client.force_authenticate(self.cashier)

        outlet = Outlet.load()
        outlet.service_percent = 5
        outlet.save()
        snacks = Category.objects.create(name="Snack", station="none")
        drinks = Category.objects.create(name="Minuman", station="bar")
        food = Category.objects.create(name="Makanan", station="kitchen")
        self.chips = Product.objects.create(
            kind=ProductKind.RETAIL,
            name="Keripik",
            category=snacks,
            price=12_000,
            barcode="8991234567890",
            tax_category=TaxCategory.PPN,
        )
        self.coffee = Product.objects.create(kind=ProductKind.MENU, name="Es Kopi", category=drinks, price=22_000)
        self.rice = Product.objects.create(kind=ProductKind.MENU, name="Nasi goreng", category=food, price=28_000)

    def open_shift(self):
        self.client.post(f"{API}shifts/", {"opening_cash": 100_000}, format="json")

    def sell(self, sale_id=None, tendered=50_000, **extra):
        return self.client.post(
            f"{API}sales/",
            {
                "id": sale_id or uid(),
                "tendered": tendered,
                "lines": [
                    {"id": uid(), "product": str(self.chips.pk), "quantity": 2},
                    {"id": uid(), "product": str(self.coffee.pk)},
                ],
                **extra,
            },
            format="json",
        )

    def test_sale_charges_no_service_and_pbjt_only_on_restaurant_items(self):
        self.open_shift()
        response = self.sell()
        self.assertEqual(response.status_code, 201, response.content)
        data = response.data["data"]
        # 46.000, no service; PBJT 10% of the coffee only (22.000) = 2.200.
        self.assertEqual(data["bill"], {**data["bill"], "service": 0, "tax": 2_200, "total": 48_200})
        self.assertEqual((data["status"], data["channel"]), (OrderStatus.PAID, "snackbar"))
        self.assertEqual(data["payments"][0]["change"], 1_800)
        receipt = PrintJob.objects.get(kind=JobKind.RECEIPT)
        self.assertEqual(receipt.payload["label"], f"Snack bar #{data['number']}")
        bar = PrintJob.objects.get(kind=JobKind.KITCHEN)
        self.assertEqual((bar.station, len(bar.payload["lines"])), ("bar", 1))

    def test_retried_sale_is_made_once(self):
        self.open_shift()
        sale_id = uid()
        first = self.sell(sale_id)
        again = self.sell(sale_id)
        self.assertEqual(first.data["data"]["number"], again.data["data"]["number"])
        self.assertEqual((Order.objects.count(), Payment.objects.count()), (1, 1))

    def test_nothing_is_kept_when_the_sale_fails(self):
        response = self.sell()
        self.assertEqual(response.data["code"], "no_open_shift")
        self.open_shift()
        response = self.sell(tendered=10_000)
        self.assertIn("tendered", response.data["errors"])
        self.assertEqual(Order.objects.count(), 0)
        self.assertFalse(PrintJob.objects.filter(kind=JobKind.KITCHEN).exists())

    def test_an_offline_sale_is_recorded_when_and_by_whom_it_happened(self):
        self.open_shift()
        owner = User.objects.create_user(None, full_name="Rina", is_superuser=True)
        self.client.force_authenticate(owner)  # Whoever is signed in when the PC syncs.
        sold_at = timezone.now() - timedelta(hours=2)
        self.chips.is_available = False  # Sold out since; it was on the shelf then.
        self.chips.price = 15_000  # And dearer: the cash taken then no longer covers it.
        self.chips.save()
        response = self.sell(sold_at=sold_at.isoformat(), cashier=self.cashier.pk, printed=True, tendered=50_000)
        self.assertEqual(response.status_code, 201, response.content)
        order = Order.objects.get()
        payment = order.payments.get()
        self.assertEqual((order.opened_by, payment.received_by), (self.cashier, self.cashier))
        self.assertEqual((order.closed_at, payment.created_at), (sold_at, sold_at))
        self.assertEqual((payment.tendered, payment.change), (50_000, 0))
        self.assertFalse(PrintJob.objects.exists())  # The PC printed it at the time.

    def test_an_offline_sale_the_pc_could_not_print_prints_when_it_syncs(self):
        self.open_shift()
        self.sell(sold_at=(timezone.now() - timedelta(minutes=5)).isoformat(), cashier=self.cashier.pk)
        self.assertEqual(set(PrintJob.objects.values_list("kind", flat=True)), {JobKind.RECEIPT, JobKind.KITCHEN})

    def test_offline_sale_limits(self):
        self.open_shift()
        too_old = self.sell(sold_at=(timezone.now() - timedelta(days=8)).isoformat())
        self.assertIn("sold_at", too_old.data["errors"])
        online = self.sell(cashier=self.cashier.pk)
        self.assertIn("cashier", online.data["errors"])
        not_cashier = self.sell(sold_at=timezone.now().isoformat(), cashier=self.waiter.pk)
        self.assertIn("cashier", not_cashier.data["errors"])
        future = self.sell(sold_at=(timezone.now() + timedelta(hours=1)).isoformat())
        self.assertEqual(future.status_code, 201)
        self.assertLessEqual(Order.objects.get().closed_at, timezone.now())
        self.assertEqual(Order.objects.count(), 1)

    def test_waiter_cannot_sell(self):
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.sell().status_code, 403)

    def test_todays_sales(self):
        self.open_shift()
        self.sell()
        self.sell()
        response = self.client.get(f"{API}sales/")
        self.assertEqual(len(response.data["data"]), 2)

    def test_retail_items_at_a_table_pay_service_but_not_pbjt(self):
        area = Area.objects.create(name="Indoor")
        table = Table.objects.create(area=area, label="1", x=0, y=0, width=80, height=80)
        order_id = uid()
        self.client.post(f"{API}orders/", {"id": order_id, "table": str(table.pk)}, format="json")
        response = self.client.post(
            f"{API}orders/{order_id}/lines/",
            {
                "lines": [{"id": uid(), "product": str(self.rice.pk)}, {"id": uid(), "product": str(self.chips.pk)}],
                "send": True,
            },
            format="json",
        )
        bill = response.data["data"]["bill"]
        # 40.000 + service 2.000; PBJT on the rice's share of 42.000 (29.400) = 2.940 → 44.940 → 44.900.
        self.assertEqual((bill["service"], bill["tax"], bill["total"]), (2_000, 2_940, 44_900))
