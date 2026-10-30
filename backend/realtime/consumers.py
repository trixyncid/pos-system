"""
One socket per tablet. The client subscribes to the outlet's streams it is
allowed to see; the API pushes changes with `realtime.broadcast.publish`.
"""

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from realtime.auth import SUBPROTOCOL

# Stream name -> permission needed to listen to it.
STREAMS = {
    "floor": "accounts.take_order",
    "orders": "accounts.take_order",
    "print": "accounts.print_station",
}


def group_name(stream: str) -> str:
    return f"outlet.{stream}"


class OutletConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close(code=4401)
            return
        self.streams: set[str] = set()
        await self.accept(subprotocol=SUBPROTOCOL)

    async def disconnect(self, code):
        for stream in getattr(self, "streams", set()):
            await self.channel_layer.group_discard(group_name(stream), self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("type") != "subscribe":
            return
        stream = content.get("stream")
        permission = STREAMS.get(stream)
        if permission is None:
            await self.send_json({"type": "error", "detail": "Unknown stream."})
            return
        if not await self._has_perm(permission):
            await self.send_json({"type": "error", "stream": stream, "detail": "Not allowed."})
            return
        self.streams.add(stream)
        await self.channel_layer.group_add(group_name(stream), self.channel_name)
        await self.send_json({"type": "subscribed", "stream": stream})

    async def outlet_event(self, message):
        """Relayed from realtime.broadcast.publish."""
        await self.send_json({"type": "event", "stream": message["stream"], "event": message["event"]})

    async def _has_perm(self, permission: str) -> bool:
        return await database_sync_to_async(self.scope["user"].has_perm)(permission)
