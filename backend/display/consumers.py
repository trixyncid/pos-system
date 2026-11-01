"""
The customer display's socket. It authenticates with its own display token,
sent as a subprotocol like the staff socket's JWT: `["pos-display", token]`.
"""

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.utils import timezone

from display.models import CustomerDisplay
from display.services import current_state, group_name

SUBPROTOCOL = "pos-display"


@database_sync_to_async
def display_for(token: str | None):
    display = CustomerDisplay.for_token(token)
    if display is not None:
        CustomerDisplay.objects.filter(pk=display.pk).update(last_seen=timezone.now())
    return display


class DisplayConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        protocols = list(self.scope.get("subprotocols") or [])
        token = protocols[1] if len(protocols) == 2 and protocols[0] == SUBPROTOCOL else None
        self.display = await display_for(token)
        if self.display is None:
            await self.close(code=4401)
            return
        self.group = group_name(self.display.pk)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept(subprotocol=SUBPROTOCOL)
        if self.display.is_paired:
            await self.send_json({"type": "state", "state": current_state(self.display.pk)})

    async def disconnect(self, code):
        if getattr(self, "group", None):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        # A display only listens.
        return

    async def display_message(self, event):
        """Relayed from display.services."""
        await self.send_json(event["message"])
