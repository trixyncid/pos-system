"""
Writing audit events. `emit` never raises into the caller and writes only
after the transaction commits, so rolled-back work is not logged.
"""

from __future__ import annotations

import logging
from typing import Any

from django.db import transaction

from audit.models import AuditEvent

logger = logging.getLogger(__name__)

# Never stored, whatever a caller passes in metadata.
_SECRET_KEYS = frozenset({"pin", "password", "token", "access", "refresh", "secret"})


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: "[redacted]" if str(key).lower() in _SECRET_KEYS else _redact(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_redact(item) for item in value]
    return value


def _client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        # Caddy is the only proxy in front of the API, so the first hop is the tablet.
        return forwarded.split(",")[0].strip() or None
    return request.META.get("REMOTE_ADDR") or None


def emit(
    request,
    action: str,
    *,
    actor=None,
    target=None,
    target_label: str = "",
    metadata: dict[str, Any] | None = None,
) -> None:
    """Record `action` by `actor` (default: the request's user) on `target`, a model instance."""
    try:
        if actor is None and request is not None:
            user = getattr(request, "user", None)
            actor = user if getattr(user, "is_authenticated", False) else None
        event = AuditEvent(
            actor_id=getattr(actor, "pk", None),
            actor_name=str(actor or "")[:150],
            action=action,
            target_type=target._meta.label_lower if target is not None else "",
            target_id=str(target.pk) if target is not None else "",
            target_label=(target_label or (str(target) if target is not None else ""))[:255],
            ip_address=_client_ip(request) if request is not None else None,
            user_agent=(request.META.get("HTTP_USER_AGENT", "") if request is not None else "")[:512],
            metadata=_redact(metadata or {}),
        )
    except Exception:
        logger.exception("Could not build audit event %s", action)
        return

    def write():
        try:
            event.save()
        except Exception:
            logger.exception("Could not write audit event %s", action)

    transaction.on_commit(write)
