from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from common.dispatch import after_commit
from realtime.consumers import group_name


def publish(stream: str, event: dict) -> None:
    """Push `event` to every tablet subscribed to `stream`, once the current transaction commits."""

    def send():
        layer = get_channel_layer()
        if layer is None:
            return
        async_to_sync(layer.group_send)(group_name(stream), {"type": "outlet.event", "stream": stream, "event": event})

    after_commit(send)
