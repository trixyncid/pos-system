from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import GroupProfile, User
from accounts.roles import CASHIER, WAITER
from accounts.services.roles import ensure_system_roles
from floor.models import Area, Table

BASE = "/api/v1/floor/"


def table(label, **extra):
    return {"label": label, "shape": "rect", "x": 100, "y": 100, "width": 80, "height": 80, "capacity": 4, **extra}


class FloorTests(TestCase):
    def setUp(self):
        ensure_system_roles()
        self.manager = User.objects.create_user("manager@example.com", "Str0ng-pass!", full_name="Dimas")
        self.manager.groups.add(GroupProfile.objects.get(code=CASHIER).group)
        self.waiter = User.objects.create_user(None, full_name="Sari")
        self.waiter.groups.add(GroupProfile.objects.get(code=WAITER).group)
        self.client = APIClient()
        self.indoor = Area.objects.create(name="Indoor")
        self.terrace = Area.objects.create(name="Teras", sort_order=1)
        self.t1 = Table.objects.create(area=self.indoor, label="1", x=50, y=50, width=80, height=80)
        self.t2 = Table.objects.create(area=self.indoor, label="2", x=200, y=50, width=80, height=80)

    def test_waiter_reads_the_floor_but_cannot_edit_it(self):
        self.client.force_authenticate(self.waiter)
        areas = self.client.get(f"{BASE}areas/").data["data"]
        self.assertEqual([area["name"] for area in areas], ["Indoor", "Teras"])
        self.assertEqual(areas[0]["tables"][0]["status"], "available")
        response = self.client.put(f"{BASE}areas/{self.indoor.pk}/layout/", {"tables": []}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_layout_save_updates_creates_and_removes(self):
        self.client.force_authenticate(self.manager)
        response = self.client.put(
            f"{BASE}areas/{self.indoor.pk}/layout/",
            {"tables": [table("1", id=str(self.t1.pk), x=400, rotation=45), table("3", shape="round")]},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        labels = sorted(row["label"] for row in response.data["data"]["tables"])
        self.assertEqual(labels, ["1", "3"])
        self.t1.refresh_from_db()
        self.assertEqual((self.t1.x, self.t1.rotation), (400, 45))
        self.assertFalse(Table.objects.filter(pk=self.t2.pk).exists())

    def test_tables_can_swap_labels_in_one_save(self):
        self.client.force_authenticate(self.manager)
        response = self.client.put(
            f"{BASE}areas/{self.indoor.pk}/layout/",
            {"tables": [table("2", id=str(self.t1.pk)), table("1", id=str(self.t2.pk))]},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.content)
        self.t1.refresh_from_db()
        self.assertEqual(self.t1.label, "2")

    def test_labels_are_unique_across_areas(self):
        self.client.force_authenticate(self.manager)
        dup = self.client.put(
            f"{BASE}areas/{self.terrace.pk}/layout/", {"tables": [table("T"), table("T")]}, format="json"
        )
        self.assertIn("tables", dup.data["errors"])
        taken = self.client.put(f"{BASE}areas/{self.terrace.pk}/layout/", {"tables": [table("1")]}, format="json")
        self.assertIn("another area", taken.data["detail"])

    def test_tables_stay_on_the_canvas(self):
        self.client.force_authenticate(self.manager)
        response = self.client.put(
            f"{BASE}areas/{self.indoor.pk}/layout/", {"tables": [table("9", x=5000)]}, format="json"
        )
        self.assertEqual(response.status_code, 400)

    def test_cleaning_a_table(self):
        self.t1.needs_cleaning = True
        self.t1.save()
        self.client.force_authenticate(self.waiter)
        response = self.client.post(f"{BASE}tables/{self.t1.pk}/clean/")
        self.assertEqual(response.data["data"]["status"], "available")
