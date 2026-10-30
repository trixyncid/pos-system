"""
The data a ticket prints. The station lays it out (frontend
src/features/printing/lib/tickets.ts); this only gathers it, so the printout
never depends on the station looking anything up.
"""

from __future__ import annotations

from django.utils import timezone


def order_label(order) -> str:
    if order.channel == "snackbar":
        return f"Snack bar #{order.number}"
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


def _outlet_header(outlet) -> dict:
    return {
        "name": outlet.name,
        "address": outlet.address,
        "header": outlet.receipt_header,
        "footer": outlet.receipt_footer,
        "npwpd": outlet.npwpd,
    }


def bill_payload(order, bill, *, kind: str, by, outlet, payment=None, paid: int = 0) -> dict:
    """A bill (before paying) or a receipt (after): every line, the totals, and the payment."""
    lines = [line for line in order.lines.all() if line.status != "void"]
    return {
        **ticket_payload(order, lines, station="cashier", kind=kind, by=by),
        "outlet": _outlet_header(outlet),
        "line_totals": [line.total for line in lines],
        "bill": bill.as_dict(),
        "rates": {
            "service": float(outlet.service_percent),
            "pbjt": float(outlet.pbjt_percent),
        },
        "discount": {"kind": "promo", "value": 0, "reason": order.promo_name}
        if order.promo_id
        else None
        if order.discount_kind == "none"
        else {"kind": order.discount_kind, "value": order.discount_value, "reason": order.discount_reason},
        "payment": None
        if payment is None
        else {
            "method": payment.method,
            "amount": payment.amount,
            "tendered": payment.tendered,
            "change": payment.change,
        },
        "paid": paid,
    }


def shift_payload(shift, *, by, unpaid_bills: int = 0) -> dict:
    totals = shift.totals()
    return {
        "kind": "shift",
        "station": "cashier",
        "by": by.full_name,
        "at": timezone.localtime().isoformat(),
        "lines": [],
        "shift": {
            "opened_at": timezone.localtime(shift.created_at).isoformat(),
            "closed_at": timezone.localtime(shift.closed_at).isoformat() if shift.closed_at else None,
            "opened_by": shift.opened_by.full_name,
            "opening_cash": shift.opening_cash,
            **totals,
            "counted_cash": shift.counted_cash,
            "variance": None if shift.counted_cash is None else shift.counted_cash - shift.expected_cash,
            "unpaid_bills": unpaid_bills,
            "movements": [
                {"kind": movement.kind, "amount": movement.amount, "reason": movement.reason}
                for movement in shift.movements.all()
            ],
        },
    }
