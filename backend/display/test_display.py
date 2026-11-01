from channels.testing.websocket import WebsocketCommunicator
from django.core.cache import cache
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import GroupProfile, User
from accounts.roles import CASHIER, OWNER, WAITER
from accounts.services.roles import ensure_system_roles
from backend.asgi import application
from display.models import CustomerDisplay

API = "/api/v1/"
LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
BILL = {"view": "cart", "label": "Meja 5", "lines": [{"name": "Es Teh Manis", "quantity": 2, "total": 16000}]}


def staff(name, role):
    user = User.objects.create_user(None, "Str0ng-pass!", full_name=name)
    user.groups.add(GroupProfile.objects.get(code=role).group)
    return user


@override_settings(CHANNEL_LAYERS=LAYERS)
class DisplayApiTests(TestCase):
    def setUp(self):
        ensure_system_roles()
        cache.clear()
        self.cashier = staff("Budi", CASHIER)
        self.client = APIClient()

    def register(self):
        response = APIClient().post(f"{API}displays/register/")
        self.assertEqual(response.status_code, 201, response.content)
        return response.data["data"]

    def test_a_display_registers_shows_a_code_and_is_paired_by_a_cashier(self):
        display = self.register()
        self.assertFalse(display["paired"])
        self.assertRegex(display["code"], r"^\d{6}$")
        mine = APIClient(HTTP_X_DISPLAY_TOKEN=display["token"])
        self.assertEqual(mine.get(f"{API}displays/self/").data["data"]["code"], display["code"])
        self.assertEqual(APIClient(HTTP_X_DISPLAY_TOKEN="nope").get(f"{API}displays/self/").status_code, 401)

        self.client.force_authenticate(self.cashier)
        paired = self.client.post(f"{API}displays/pair/", {"code": display["code"]}, format="json")
        self.assertEqual(paired.status_code, 200, paired.content)
        self.assertEqual(paired.data["data"]["paired_by_name"], "Budi")
        me = mine.get(f"{API}displays/self/").data["data"]
        self.assertEqual((me["paired"], me["code"]), (True, None))
        # The code is used up.
        again = self.client.post(f"{API}displays/pair/", {"code": display["code"]}, format="json")
        self.assertEqual(again.status_code, 400)

    def test_the_cashier_sends_what_to_show(self):
        display = self.register()
        self.client.force_authenticate(self.cashier)
        url = f"{API}displays/{display['id']}/state/"
        self.assertEqual(self.client.post(url, {"state": BILL}, format="json").status_code, 404)  # Not paired yet.
        self.client.post(f"{API}displays/pair/", {"code": display["code"]}, format="json")
        self.assertEqual(self.client.post(url, {"state": BILL}, format="json").status_code, 200)
        bad = self.client.post(url, {"state": {"view": "party"}}, format="json")
        self.assertEqual(bad.status_code, 400)

    def test_waiters_cannot_pair_and_only_the_owner_manages_displays(self):
        display = self.register()
        self.client.force_authenticate(staff("Sari", WAITER))
        self.assertEqual(self.client.post(f"{API}displays/pair/", {"code": display["code"]}).status_code, 403)
        self.client.force_authenticate(self.cashier)
        self.client.post(f"{API}displays/pair/", {"code": display["code"]}, format="json")
        self.assertEqual(self.client.get(f"{API}displays/").status_code, 403)

        self.client.force_authenticate(staff("Rina", OWNER))
        listed = self.client.get(f"{API}displays/").data["data"]
        self.assertEqual([row["id"] for row in listed], [display["id"]])
        self.assertEqual(self.client.delete(f"{API}displays/{display['id']}/").status_code, 200)
        self.assertFalse(CustomerDisplay.objects.exists())


@override_settings(CHANNEL_LAYERS=LAYERS, ALLOWED_HOSTS=["testserver"])
class DisplaySocketTests(TransactionTestCase):
    def setUp(self):
        ensure_system_roles()
        cache.clear()

    def socket(self, token):
        return WebsocketCommunicator(
            application,
            "/ws/display/",
            subprotocols=["pos-display", token],
            headers=[(b"origin", b"http://testserver"), (b"host", b"testserver")],
        )

    async def test_an_unknown_token_is_refused(self):
        connected, code = await self.socket("nope").connect()
        self.assertFalse(connected)
        self.assertEqual(code, 4401)

    async def test_the_display_hears_pairing_and_each_new_state(self):
        from asgiref.sync import sync_to_async

        display = (await sync_to_async(APIClient().post)(f"{API}displays/register/")).data["data"]
        socket = self.socket(display["token"])
        connected, subprotocol = await socket.connect()
        self.assertTrue(connected)
        self.assertEqual(subprotocol, "pos-display")

        cashier = await sync_to_async(staff)("Budi", CASHIER)
        client = APIClient()
        client.force_authenticate(cashier)
        await sync_to_async(client.post)(f"{API}displays/pair/", {"code": display["code"]}, format="json")
        self.assertEqual(await socket.receive_json_from(), {"type": "paired"})

        url = f"{API}displays/{display['id']}/state/"
        await sync_to_async(client.post)(url, {"state": BILL}, format="json")
        self.assertEqual(await socket.receive_json_from(), {"type": "state", "state": BILL})
        await socket.disconnect()

        # A display that reconnects catches up on what is showing.
        again = self.socket(display["token"])
        await again.connect()
        self.assertEqual(await again.receive_json_from(), {"type": "state", "state": BILL})
        await again.disconnect()
