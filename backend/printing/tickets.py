"""
The data a ticket prints. The station lays it out (frontend
src/features/printing/lib/tickets.ts); this only gathers it, so the printout
never depends on the station looking anything up.
"""

from __future__ import annotations

from django.utils import timezone


def order_label(order) -> str:
    if order.table_label:
        return f"Meja {order.table_label}"
    return f"Bawa pulang #{order.number}"


def ticket_payload(order, lines, *, station: str, kind: str, by) -> dict:
    return {
        "kind": kind,
        "station": station,
        "order_id": str(order.pk),
        "order_number": order.number,
        "label": order_label(order),
        "type": order.type,
        "guests": order.guests,
        "by": by.full_name,
        "at": timezone.localtime().isoformat(),
        "lines": [
            {
                "quantity": line.quantity,
                "name": line.name,
                "modifiers": [modifier["name"] for modifier in line.modifiers],
                "note": line.note,
                "seat": line.seat,
                "void_reason": line.void_reason or None,
            }
            for line in lines
        ],
    }
