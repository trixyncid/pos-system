from io import StringIO

from django.core.management import CommandError, call_command
from django.test import TestCase
from rest_framework.test import APIClient

from catalog.models import Product
from orders.models import Order, OrderStatus
from shifts.models import Shift

API = "/api/v1/"


class SeedDemoTests(TestCase):
    def seed(self, *args):
        call_command("seed_demo", "--photos", "/nowhere", *args, stdout=StringIO())

    def test_fills_an_empty_database_that_the_app_can_use(self):
        self.seed()
        self.assertEqual(Product.objects.filter(kind="retail").count(), 39)
        self.assertEqual(Order.objects.filter(status__in=[OrderStatus.OPEN, OrderStatus.BILLED]).count(), 6)
        self.assertTrue(Order.objects.filter(status=OrderStatus.PAID).exists())
        self.assertEqual(Shift.objects.filter(closed_at__isnull=True).count(), 1)

        client = APIClient()
        login = client.post(f"{API}auth/login/", {"username": "rina", "password": "demo1234"}, format="json")
        self.assertEqual(login.status_code, 200, login.content)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        self.assertEqual(client.get(f"{API}reports/dashboard/").status_code, 200)

    def test_refuses_to_seed_over_data_unless_reset(self):
        self.seed()
        with self.assertRaises(CommandError):
            self.seed()
        self.seed("--reset")
        self.assertEqual(Order.objects.filter(status=OrderStatus.OPEN).count(), 5)
