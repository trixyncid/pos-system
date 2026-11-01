"""
What a customer display shows is whatever the paired cashier last sent: kept
in the cache (so a display that reconnects catches up) and pushed over its
WebSocket group.
"""

import json
from datetime import timedelta

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from display.models import CustomerDisplay

STATE_TTL = 12 * 60 * 60
MAX_STATE_BYTES = 32 * 1024
VIEWS = {"idle", "cart", "pay", "paid"}
# Unpaired registrations (a display that was opened and never paired) are dropped after this.
UNPAIRED_LIFETIME = timedelta(days=1)


def group_name(display_id) -> str:
    return f"display.{display_id}"


def state_key(display_id) -> str:
    return f"display:{display_id}:state"


def _send(display_id, message: dict) -> None:
    layer = get_channel_layer()
    if layer is not None:
        async_to_sync(layer.group_send)(group_name(display_id), {"type": "display.message", "message": message})


def current_state(display_id) -> dict:
    return cache.get(state_key(display_id)) or {"view": "idle"}


def push_state(display: CustomerDisplay, state: dict) -> dict:
    if not isinstance(state, dict) or state.get("view") not in VIEWS:
        raise ValidationError({"state": ["Unknown view."]})
    if len(json.dumps(state)) > MAX_STATE_BYTES:
        raise ValidationError({"state": ["Too large."]})
    cache.set(state_key(display.pk), state, STATE_TTL)
    _send(display.pk, {"type": "state", "state": state})
    return state


def register() -> tuple[CustomerDisplay, str]:
    CustomerDisplay.objects.filter(paired_at__isnull=True, created_at__lt=timezone.now() - UNPAIRED_LIFETIME).delete()
    return CustomerDisplay.register()


def pair(*, code: str, user) -> CustomerDisplay:
    display = CustomerDisplay.objects.filter(code=code.strip(), paired_at__isnull=True).first()
    if display is None:
        raise ValidationError({"code": ["No display is showing this code."]})
    display.code = None
    display.paired_at = timezone.now()
    display.paired_by = user
    display.save(update_fields=["code", "paired_at", "paired_by", "updated_at"])
    _send(display.pk, {"type": "paired"})
    return display


def remove(display: CustomerDisplay) -> None:
    display_id = display.pk
    display.delete()
    cache.delete(state_key(display_id))
    _send(display_id, {"type": "revoked"})
