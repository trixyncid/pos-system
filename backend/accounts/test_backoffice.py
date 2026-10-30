from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import GroupProfile, User
from accounts.roles import CASHIER, MANAGER, OWNER, WAITER
from accounts.services.roles import ensure_system_roles
from audit.models import AuditEvent

STAFF = "/api/v1/staff/"
ROLES = "/api/v1/roles/"
PERMISSIONS = "/api/v1/permissions/"


def role(code):
    return GroupProfile.objects.get(code=code).group


class BackofficeTests(TestCase):
    def setUp(self):
        ensure_system_roles()
        # The manager role gets manage_staff here so the escalation rules can be tested.
        manager_role = role(MANAGER)
        from accounts.permission_catalog import permissions_by_name

        found, _ = permissions_by_name(["accounts.manage_staff"])
        manager_role.permissions.add(*found)

        self.owner = User.objects.create_user("owner@example.com", "Str0ng-pass!", full_name="Rina")
        self.owner.groups.add(role(OWNER))
        self.manager = User.objects.create_user("manager@example.com", "Str0ng-pass!", full_name="Dimas")
        self.manager.groups.add(manager_role)
        self.waiter = User.objects.create_user(None, full_name="Sari")
        self.waiter.groups.add(role(WAITER))
        self.client = APIClient()

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self.client

    def test_staff_endpoints_need_manage_staff(self):
        self.as_user(self.waiter)
        self.assertEqual(self.client.get(STAFF).status_code, 403)
        self.assertEqual(self.client.get(ROLES).status_code, 403)
        self.assertEqual(self.client.get(PERMISSIONS).status_code, 403)

    def test_owner_creates_pin_only_staff(self):
        self.as_user(self.owner)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                STAFF, {"full_name": "Agus", "pin": "5555", "roles": [role(WAITER).pk]}, format="json"
            )
        self.assertEqual(response.status_code, 201, response.content)
        data = response.data["data"]
        self.assertEqual(data["email"], None)
        self.assertTrue(data["has_pin"])
        self.assertFalse(data["can_sign_in"])
        self.assertEqual(data["role_names"], ["Pelayan"])
        self.assertNotIn("pin", data)
        self.assertTrue(AuditEvent.objects.filter(action="staff.create").exists())
        self.assertTrue(User.objects.get(pk=data["id"]).check_pin("5555"))

    def test_password_needs_an_email(self):
        self.as_user(self.owner)
        response = self.client.post(STAFF, {"full_name": "Agus", "password": "Str0ng-pass!"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("password", response.data["errors"])

    def test_manager_cannot_hand_out_the_owner_role(self):
        self.as_user(self.manager)
        response = self.client.post(STAFF, {"full_name": "X", "roles": [role(OWNER).pk]}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("roles", response.data["errors"])
        ok = self.client.post(STAFF, {"full_name": "Y", "roles": [role(CASHIER).pk]}, format="json")
        self.assertEqual(ok.status_code, 201, ok.content)

    def test_manager_cannot_edit_or_reset_pin_of_the_owner(self):
        self.as_user(self.manager)
        self.assertEqual(
            self.client.patch(f"{STAFF}{self.owner.pk}/", {"full_name": "Hacked"}, format="json").status_code, 400
        )
        self.assertEqual(
            self.client.post(f"{STAFF}{self.owner.pk}/set-pin/", {"pin": "0000"}, format="json").status_code, 400
        )

    def test_nobody_deactivates_themselves_or_changes_own_roles(self):
        self.as_user(self.owner)
        response = self.client.patch(f"{STAFF}{self.owner.pk}/", {"is_active": False}, format="json")
        self.assertIn("is_active", response.data["errors"])
        response = self.client.patch(f"{STAFF}{self.owner.pk}/", {"roles": []}, format="json")
        self.assertIn("roles", response.data["errors"])

    def test_deactivating_signs_the_account_out(self):
        from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

        from accounts.services.tokens import issue_pair

        issue_pair(self.waiter)
        self.as_user(self.owner)
        self.client.patch(f"{STAFF}{self.waiter.pk}/", {"is_active": False}, format="json")
        token = OutstandingToken.objects.get(user=self.waiter)
        self.assertTrue(hasattr(token, "blacklistedtoken"))

    def test_set_pin(self):
        self.as_user(self.owner)
        response = self.client.post(f"{STAFF}{self.waiter.pk}/set-pin/", {"pin": "12"}, format="json")
        self.assertEqual(response.status_code, 400)
        response = self.client.post(f"{STAFF}{self.waiter.pk}/set-pin/", {"pin": "4321"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.waiter.refresh_from_db()
        self.assertTrue(self.waiter.check_pin("4321"))

    def test_search_and_active_filter(self):
        self.as_user(self.owner)
        self.waiter.is_active = False
        self.waiter.save()
        names = [row["full_name"] for row in self.client.get(STAFF, {"active": "true"}).data["results"]]
        self.assertNotIn("Sari", names)
        names = [row["full_name"] for row in self.client.get(STAFF, {"search": "sar"}).data["results"]]
        self.assertEqual(names, ["Sari"])

    def test_permission_catalog_lists_pos_actions(self):
        self.as_user(self.owner)
        codes = [row["codename"] for row in self.client.get(PERMISSIONS).data["data"]]
        self.assertIn("accounts.take_order", codes)
        self.assertTrue(all(code.startswith("accounts.") for code in codes))

    def test_role_crud_and_rules(self):
        self.as_user(self.owner)
        created = self.client.post(
            ROLES,
            {"name": "Barista", "code": "barista", "permissions": ["accounts.take_order", "accounts.reprint"]},
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.content)
        barista = created.data["data"]
        self.assertEqual(barista["permissions"], ["accounts.reprint", "accounts.take_order"])
        self.assertFalse(barista["is_system"])

        bad = self.client.patch(f"{ROLES}{barista['id']}/", {"permissions": ["accounts.nope"]}, format="json")
        self.assertIn("permissions", bad.data["errors"])

        owner_edit = self.client.patch(f"{ROLES}{role(OWNER).pk}/", {"permissions": []}, format="json")
        self.assertEqual(owner_edit.status_code, 400)
        self.assertEqual(self.client.delete(f"{ROLES}{role(WAITER).pk}/").status_code, 400)
        self.assertEqual(self.client.delete(f"{ROLES}{barista['id']}/").status_code, 200)

    def test_manager_cannot_grant_more_than_they_hold(self):
        self.as_user(self.manager)
        response = self.client.post(
            ROLES, {"name": "Super", "code": "super", "permissions": ["accounts.manage_settings"]}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("permissions", response.data["errors"])

    def test_manager_cannot_remove_own_staff_access(self):
        self.as_user(self.manager)
        response = self.client.patch(
            f"{ROLES}{role(MANAGER).pk}/", {"permissions": ["accounts.take_order"]}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("own access", response.data["errors"]["permissions"][0])

    def test_seeding_keeps_the_owners_changes_unless_reset(self):
        from accounts.permission_catalog import permissions_by_name

        cashier = role(CASHIER)
        found, _ = permissions_by_name(["accounts.apply_discount"])
        cashier.permissions.add(*found)
        ensure_system_roles()
        self.assertTrue(cashier.permissions.filter(codename="apply_discount").exists())
        ensure_system_roles(reset=True)
        self.assertFalse(cashier.permissions.filter(codename="apply_discount").exists())
