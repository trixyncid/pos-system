from django.conf import settings
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from accounts.roles import CASHIER
from accounts.services.roles import ensure_system_roles
from audit.models import AuditEvent

LOGIN = "/api/v1/auth/login/"
REFRESH = "/api/v1/auth/refresh/"
LOGOUT = "/api/v1/auth/logout/"
ME = "/api/v1/auth/me/"


class AuthTests(TestCase):
    def setUp(self):
        ensure_system_roles()
        self.owner = User.objects.create_user("owner@example.com", "Str0ng-pass!", username="rina", full_name="Rina")
        self.cashier = User.objects.create_user(None, "Str0ng-pass!", username="budi", full_name="Budi")
        self.cashier.groups.add(self.cashier_group())
        self.web = APIClient(HTTP_X_SESSION_COOKIE="1")

    def cashier_group(self):
        from accounts.models import GroupProfile

        return GroupProfile.objects.get(code=CASHIER).group

    def sign_in(self, client=None):
        client = client or self.web
        response = client.post(LOGIN, {"username": "rina", "password": "Str0ng-pass!"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        return response

    def test_web_login_puts_refresh_in_httponly_cookie(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.sign_in()
        self.assertNotIn("refresh", response.data)
        cookie = response.cookies[settings.REFRESH_COOKIE_NAME]
        self.assertTrue(cookie["httponly"])
        self.assertEqual(cookie["path"], settings.REFRESH_COOKIE_PATH)
        self.assertTrue(AuditEvent.objects.filter(action="auth.login", actor=self.owner).exists())
        self.owner.refresh_from_db()
        self.assertIsNotNone(self.owner.last_login)

    def test_native_login_returns_refresh_in_body(self):
        response = APIClient().post(LOGIN, {"username": "rina", "password": "Str0ng-pass!"}, format="json")
        self.assertIn("refresh", response.data)

    def test_username_is_not_case_sensitive_and_email_still_works(self):
        for name in ("BUDI", "owner@example.com"):
            response = APIClient().post(LOGIN, {"username": name, "password": "Str0ng-pass!"}, format="json")
            self.assertEqual(response.status_code, 200, (name, response.content))

    def test_an_inactive_account_cannot_sign_in(self):
        self.cashier.is_active = False
        self.cashier.save()
        response = APIClient().post(LOGIN, {"username": "budi", "password": "Str0ng-pass!"}, format="json")
        self.assertEqual(response.status_code, 401)

    def test_usernames_are_generated_for_accounts_made_without_one(self):
        first = User.objects.create_user(None, full_name="Sari Lestari")
        second = User.objects.create_user(None, full_name="Sari Lestari")
        self.assertEqual((first.username, second.username), ("sari.lestari", "sari.lestari2"))

    def test_wrong_password_uses_error_envelope(self):
        response = self.web.post(LOGIN, {"username": "rina", "password": "nope"}, format="json")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.data,
            {"success": False, "detail": "Username or password is incorrect.", "code": "invalid_credentials"},
        )

    def test_validation_errors_carry_field_messages(self):
        response = self.web.post(LOGIN, {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertIn("username", response.data["errors"])
        self.assertIn("password", response.data["errors"])

    def test_refresh_rotates_cookie_and_logout_revokes_it(self):
        self.sign_in()
        refreshed = self.web.post(REFRESH)
        self.assertEqual(refreshed.status_code, 200)
        self.assertIn("access", refreshed.data)
        self.assertIn(settings.REFRESH_COOKIE_NAME, refreshed.cookies)

        self.assertEqual(self.web.post(LOGOUT).status_code, 200)
        self.assertEqual(self.web.post(REFRESH).status_code, 401)

    def test_me_lists_permissions(self):
        self.sign_in()
        self.owner.groups.add(self.cashier_group())
        response = self.web.get(ME)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual((data["roles"][0]["code"], data["username"]), (CASHIER, "rina"))
        # Kasir does what a manager used to: voids, discounts, reports.
        for permission in ("accounts.take_payment", "accounts.void_sent_item", "accounts.view_reports"):
            self.assertIn(permission, data["permissions"])
        self.assertNotIn("accounts.manage_staff", data["permissions"])
