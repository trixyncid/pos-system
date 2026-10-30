from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from accounts.roles import OWNER
from accounts.services.roles import ensure_system_roles

URL = "/api/v1/outlet/"


class OutletTests(TestCase):
    def setUp(self):
        ensure_system_roles()
        self.client = APIClient()
        self.waiter = User.objects.create_user("waiter@example.com", "Str0ng-pass!", full_name="Sari")
        self.owner = User.objects.create_user("owner@example.com", "Str0ng-pass!", full_name="Andi")
        from accounts.models import GroupProfile

        self.owner.groups.add(GroupProfile.objects.get(code=OWNER).group)

    def test_signed_in_staff_read_the_outlet(self):
        self.client.force_authenticate(self.waiter)
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["success"])
        self.assertEqual(response.data["data"]["pbjt_percent"], 10)

    def test_anonymous_gets_401_envelope(self):
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 401)
        self.assertFalse(response.data["success"])
        self.assertEqual(response.data["code"], "not_authenticated")

    def test_only_manage_settings_can_change_it(self):
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.patch(URL, {"name": "X"}, format="json").status_code, 403)
        self.client.force_authenticate(self.owner)
        response = self.client.patch(URL, {"name": "Warung Senja", "pbjt_percent": 11}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("pbjt_percent", response.data["errors"])
        response = self.client.patch(URL, {"name": "Warung Senja"}, format="json")
        self.assertEqual(response.data["data"]["name"], "Warung Senja")
