from django.conf import settings
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from accounts.roles import CASHIER
from accounts.services.roles import ensure_system_roles
from audit.models import AuditEvent

LOGIN = "/api/v1/auth/login/"
REFRESH = "/api/v1/auth/refresh/"
LOGOUT = "/api/v1/auth/logout/"
ME = "/api/v1/auth/me/"
PIN = "/api/v1/auth/pin-unlock/"
LOCK_STAFF = "/api/v1/auth/lock-staff/"


class AuthTests(TestCase):
    def setUp(self):
        ensure_system_roles()
        self.manager = User.objects.create_user("manager@example.com", "Str0ng-pass!", full_name="Rina")
        self.cashier = User.objects.create_user("kasir@example.com", "Str0ng-pass!", full_name="Budi")
        self.cashier.set_pin("1234")
        self.cashier.save()
        self.cashier.groups.add(self.cashier_group())
        self.web = APIClient(HTTP_X_SESSION_COOKIE="1")

    def cashier_group(self):
        from accounts.models import GroupProfile

        return GroupProfile.objects.get(code=CASHIER).group

    def sign_in(self, client=None):
        client = client or self.web
        response = client.post(LOGIN, {"email": "manager@example.com", "password": "Str0ng-pass!"}, format="json")
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
        self.assertTrue(AuditEvent.objects.filter(action="auth.login", actor=self.manager).exists())

    def test_native_login_returns_refresh_in_body(self):
        response = APIClient().post(LOGIN, {"email": "manager@example.com", "password": "Str0ng-pass!"}, format="json")
        self.assertIn("refresh", response.data)

    def test_wrong_password_uses_error_envelope(self):
        response = self.web.post(LOGIN, {"email": "manager@example.com", "password": "nope"}, format="json")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.data,
            {"success": False, "detail": "Email or password is incorrect.", "code": "invalid_credentials"},
        )

    def test_validation_errors_carry_field_messages(self):
        response = self.web.post(LOGIN, {"email": "not-an-email"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.data["success"])
        self.assertIn("email", response.data["errors"])
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
        self.manager.groups.add(self.cashier_group())
        response = self.web.get(ME)
        self.assertEqual(response.status_code, 200)
        data = response.data["data"]
        self.assertEqual(data["roles"][0]["code"], CASHIER)
        self.assertIn("accounts.take_payment", data["permissions"])
        self.assertNotIn("accounts.void_sent_item", data["permissions"])

    def test_pin_unlock_switches_the_tablet_to_that_staff_member(self):
        self.sign_in()
        response = self.web.post(PIN, {"user_id": self.cashier.pk, "pin": "1234"}, format="json")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.data["user"]["email"], "kasir@example.com")
        self.assertNotIn("1234", response.content.decode())

    def test_pin_unlock_needs_a_signed_in_tablet(self):
        response = APIClient().post(PIN, {"user_id": self.cashier.pk, "pin": "1234"}, format="json")
        self.assertEqual(response.status_code, 401)

    @override_settings(PIN_MAX_ATTEMPTS=3)
    def test_wrong_pins_lock_the_pin(self):
        self.sign_in()
        codes = [
            self.web.post(PIN, {"user_id": self.cashier.pk, "pin": "0000"}, format="json").data["code"]
            for _ in range(3)
        ]
        self.assertEqual(codes, ["pin_incorrect", "pin_incorrect", "pin_locked"])
        right = self.web.post(PIN, {"user_id": self.cashier.pk, "pin": "1234"}, format="json")
        self.assertEqual(right.status_code, 403)
        self.assertEqual(right.data["code"], "pin_locked")

    def test_pin_is_stored_hashed(self):
        self.cashier.refresh_from_db()
        self.assertNotIn("1234", self.cashier.pin_hash)
        self.assertTrue(self.cashier.pin_hash.startswith(("pbkdf2_", "argon2", "bcrypt", "scrypt")))

    def test_lock_staff_lists_only_people_with_a_pin(self):
        self.assertEqual(self.web.get(LOCK_STAFF).status_code, 401)
        self.sign_in()
        response = self.web.get(LOCK_STAFF)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"], [{"id": self.cashier.pk, "full_name": "Budi", "role": "Kasir"}])
