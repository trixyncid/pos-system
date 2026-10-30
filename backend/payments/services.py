"""
Discounts, the printed bill, and taking money. An order is paid when its
payments reach the bill total; then it closes and its table needs cleaning.
"""

from __future__ import annotations

import uuid

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from orders.models import DiscountKind, LineStatus, OrderStatus
from orders.services import ApprovalRequired, _assert_open, _changed, _locked
from outlet.models import Outlet
from payments.billing import lines_bill, order_bill
from payments.models import Method, Payment
from printing.models import JobKind, PrintJob
from printing.tickets import bill_payload
from realtime.broadcast import publish
from shifts.services import require_open_shift

APPLY_DISCOUNT = "accounts.apply_discount"


def paid_total(order) -> int:
    return sum(payment.amount for payment in order.payments.all())


def _queue(order, user, kind: str, *, payment=None) -> PrintJob:
    outlet = Outlet.load()
    job = PrintJob.objects.create(
        station="cashier",
        kind=kind,
        order=order,
        created_by=user,
        payload=bill_payload(
            order, order_bill(order, outlet), kind=kind, by=user, outlet=outlet, payment=payment, paid=paid_total(order)
        ),
    )
    publish("print", {"type": "print.job", "id": str(job.pk), "station": job.station})
    return job


@transaction.atomic
def set_discount(*, user, order_id, kind: str, value: int, reason: str, approver=None):
    """A bill discount. Without accounts.apply_discount, a manager approves by PIN."""
    order = _locked(order_id)
    _assert_open(order)
    if kind != DiscountKind.NONE:
        if kind == DiscountKind.PERCENT and not 0 < value <= 100:
            raise ValidationError({"value": ["A percent discount is 1 to 100."]})
        if kind == DiscountKind.AMOUNT and value <= 0:
            raise ValidationError({"value": ["Enter an amount."]})
        if not reason.strip():
            raise ValidationError({"reason": ["Say why."]})
        if order.payments.exists():
            raise ValidationError({"detail": "Part of this bill is paid; the discount can no longer change."})
    authorised_by = user if user.has_perm(APPLY_DISCOUNT) else approver
    if authorised_by is None:
        raise ApprovalRequired("A manager must approve this discount.")
    if kind != DiscountKind.NONE:
        # One discount per bill: a manual discount replaces a promo.
        order.promo = None
        order.promo_name = ""
    order.discount_kind = kind
    order.discount_value = 0 if kind == DiscountKind.NONE else value
    order.discount_reason = "" if kind == DiscountKind.NONE else reason.strip()
    order.discount_by = None if kind == DiscountKind.NONE else user
    order.discount_approved_by = None if kind == DiscountKind.NONE else authorised_by
    if order.status == OrderStatus.BILLED:
        order.status = OrderStatus.OPEN
        order.billed_at = None
    order.save()
    _changed(order)
    return order, authorised_by


@transaction.atomic
def print_bill(*, user, order_id):
    order = _locked(order_id)
    _assert_open(order)
    if not order.lines.exclude(status=LineStatus.VOID).exists():
        raise ValidationError({"detail": "There is nothing on this bill yet."})
    if order.lines.filter(status=LineStatus.HELD).exists():
        raise ValidationError({"detail": "Send or remove held items before printing the bill."})
    order.status = OrderStatus.BILLED
    order.billed_at = timezone.now()
    order.save(update_fields=["status", "billed_at", "updated_at"])
    _queue(order, user, JobKind.BILL)
    _changed(order)
    return order


@transaction.atomic
def pay(*, user, order_id, payment_id, method: str, tendered: int, amount: int | None, line_ids: list | None):
    """
    Take one payment. With `line_ids` the guest pays for those items (their
    share of discount, service and tax); with `amount` a part of what is left
    (an even split); with neither, everything that is left.
    """
    existing = Payment.objects.filter(pk=payment_id).first()
    if existing is not None:
        return existing.order, existing  # A retried request.
    order = _locked(order_id)
    _assert_open(order)
    if order.lines.filter(status=LineStatus.HELD).exists():
        raise ValidationError({"detail": "Send or remove held items before taking payment."})
    shift = require_open_shift()
    outlet = Outlet.load()
    bill = order_bill(order, outlet)
    remaining = bill.total - paid_total(order)
    if remaining <= 0:
        raise ValidationError({"detail": "This bill is already paid."})

    lines = []
    if line_ids:
        lines = list(order.lines.filter(pk__in=line_ids, payment__isnull=True).exclude(status=LineStatus.VOID))
        if len(lines) != len(set(line_ids)):
            raise ValidationError({"line_ids": ["Some items are already paid or no longer on the bill."]})
        due = lines_bill(order, lines, outlet).total
        unpaid_left = (
            order.lines.filter(payment__isnull=True)
            .exclude(status=LineStatus.VOID)
            .exclude(pk__in=[line.pk for line in lines])
        )
        # The last items settle the exact remainder, so rounding never leaves a few rupiah open.
        due = remaining if not unpaid_left.exists() else min(due, remaining)
    elif amount is not None:
        if not 0 < amount <= remaining:
            raise ValidationError({"amount": ["More than what is left on the bill."]})
        due = amount
    else:
        due = remaining

    if method == Method.CASH and tendered < due:
        raise ValidationError({"tendered": ["Not enough cash."]})
    payment = Payment.objects.create(
        id=payment_id,
        order=order,
        shift=shift,
        method=method,
        amount=due,
        tendered=tendered if method == Method.CASH else due,
        change=tendered - due if method == Method.CASH else 0,
        received_by=user,
    )
    if lines:
        order.lines.filter(pk__in=[line.pk for line in lines]).update(payment=payment)

    if paid_total(order) >= bill.total:
        order.status = OrderStatus.PAID
        order.closed_at = timezone.now()
        order.save(update_fields=["status", "closed_at", "updated_at"])
        if order.table is not None:
            order.table.needs_cleaning = True
            order.table.save(update_fields=["needs_cleaning", "updated_at"])
    _queue(order, user, JobKind.RECEIPT, payment=payment)
    _changed(order)
    return order, payment


@transaction.atomic
def sell(*, user, sale_id, lines: list, tendered: int, method: str = Method.CASH):
    """
    A snack bar counter sale in one step: the order, its lines (anything
    with a kitchen or bar station still gets a ticket), the payment and the
    receipt. A retried request returns the sale it already made.
    """
    from orders.models import Channel, Order, OrderType
    from orders.services import add_lines, open_order

    existing = Order.objects.filter(pk=sale_id).first()
    if existing is not None:
        return existing
    require_open_shift()  # Before anything is created, so a closed drawer leaves nothing behind.
    order = open_order(
        user=user, order_id=sale_id, table=None, guests=1, type=OrderType.TAKEAWAY, channel=Channel.SNACKBAR
    )
    add_lines(user=user, order_id=order.pk, lines=lines, send=True)
    order, _ = pay(
        user=user,
        order_id=order.pk,
        payment_id=uuid.uuid4(),
        method=method,
        tendered=tendered,
        amount=None,
        line_ids=None,
    )
    return order
