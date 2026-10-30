"""Opening, moving cash in and out of, and closing the drawer."""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from printing.models import JobKind, PrintJob
from printing.tickets import shift_payload
from realtime.broadcast import publish
from shifts.models import CashMovement, Shift


class NoOpenShift(APIException):
    status_code = 400
    default_detail = "Open a shift first: cash goes into the drawer."
    default_code = "no_open_shift"


def current_shift() -> Shift | None:
    return Shift.objects.filter(closed_at__isnull=True).first()


def require_open_shift() -> Shift:
    shift = current_shift()
    if shift is None:
        raise NoOpenShift()
    return shift


@transaction.atomic
def open_shift(*, user, opening_cash: int) -> Shift:
    if current_shift() is not None:
        raise ValidationError({"detail": "A shift is already open. Close it first."})
    try:
        with transaction.atomic():
            return Shift.objects.create(opened_by=user, opening_cash=opening_cash)
    except IntegrityError as exc:
        raise ValidationError({"detail": "Another tablet just opened a shift."}) from exc


@transaction.atomic
def move_cash(*, user, shift_id, kind: str, amount: int, reason: str) -> CashMovement:
    shift = Shift.objects.select_for_update().get(pk=shift_id)
    if not shift.is_open:
        raise ValidationError({"detail": "This shift is closed."})
    if kind == "out" and amount > shift.totals()["expected_cash"]:
        raise ValidationError({"amount": ["There isn't that much cash in the drawer."]})
    return CashMovement.objects.create(shift=shift, kind=kind, amount=amount, reason=reason.strip(), by=user)


@transaction.atomic
def close_shift(*, user, shift_id, counted_cash: int, note: str) -> Shift:
    shift = Shift.objects.select_for_update().get(pk=shift_id)
    if not shift.is_open:
        raise ValidationError({"detail": "This shift is already closed."})
    from orders.models import Order, OrderStatus

    unpaid = Order.objects.filter(status=OrderStatus.BILLED).count()
    shift.expected_cash = shift.totals()["expected_cash"]
    shift.counted_cash = counted_cash
    shift.closed_by = user
    shift.closed_at = timezone.now()
    shift.note = note.strip()
    shift.save()
    job = PrintJob.objects.create(
        station="cashier",
        kind=JobKind.SHIFT,
        created_by=user,
        payload=shift_payload(shift, by=user, unpaid_bills=unpaid),
    )
    publish("print", {"type": "print.job", "id": str(job.pk), "station": job.station})
    return shift
