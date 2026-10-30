from channels.db import database_sync_to_async
from channels.testing.websocket import WebsocketCommunicator
from django.test import TransactionTestCase, override_settings

from accounts.models import GroupProfile, User
from accounts.roles import WAITER
from accounts.services.roles import ensure_system_roles
from accounts.services.tokens import issue_pair
from backend.asgi import application

LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


@override_settings(CHANNEL_LAYERS=LAYERS, ALLOWED_HOSTS=["testserver"])
class OutletSocketTests(TransactionTestCase):
    def setUp(self):
        ensure_system_roles()
        self.waiter = User.objects.create_user("waiter@example.com", "Str0ng-pass!", full_name="Sari")
        self.waiter.groups.add(GroupProfile.objects.get(code=WAITER).group)

    def communicator(self, token: str | None):
        protocols = ["pos-auth", token] if token else []
        return WebsocketCommunicator(
            application,
            "/ws/outlet/",
            subprotocols=protocols,
            headers=[(b"origin", b"http://testserver"), (b"host", b"testserver")],
        )

    async def test_socket_without_token_is_closed(self):
        connected, code = await self.communicator(None).connect()
        self.assertFalse(connected)
        self.assertEqual(code, 4401)

    async def test_streams_follow_permissions(self):
        access, _ = await database_sync_to_async(issue_pair)(self.waiter)
        socket = self.communicator(access)
        connected, subprotocol = await socket.connect()
        self.assertTrue(connected)
        self.assertEqual(subprotocol, "pos-auth")

        await socket.send_json_to({"type": "subscribe", "stream": "floor"})
        self.assertEqual(await socket.receive_json_from(), {"type": "subscribed", "stream": "floor"})

        await socket.send_json_to({"type": "subscribe", "stream": "print"})
        reply = await socket.receive_json_from()
        self.assertEqual(reply["type"], "error")
        await socket.disconnect()
