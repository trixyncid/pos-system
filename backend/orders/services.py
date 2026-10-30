"""
What happens to an order. Views stay thin; every rule about adding, sending,
voiding, moving and merging lives here, inside one transaction per action.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from django.db import IntegrityError, transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from accounts.models import User
from catalog.models import Product, ProductKind
from floor.models import Table
from inventory import services as inventory
from orders.models import SEATED, LineStatus, Order, OrderLine, OrderStatus
from printing.models import JobKind, PrintJob
from printing.tickets import ticket_payload
from realtime.broadcast import publish


class ApprovalRequired(PermissionDenied):
    default_detail = "A manager must approve this void."
    default_code = "approval_required"


class ApprovalRejected(PermissionDenied):
    default_detail = "This approval was not accepted."
    default_code = "approval_rejected"


APPROVE = "accounts.approve_override"
VOID_SENT = "accounts.void_sent_item"


def _changed(order: Order, *, floor: bool = True) -> None:
    order.bump()
    publish("orders", {"type": "order.changed", "id": str(order.pk), "version": order.version})
    if floor and order.table_id:
        publish("floor", {"type": "floor.changed"})


def _next_number() -> int:
    """Today's running number. The lock keeps two tablets from taking the same one."""
    today = timezone.localdate()
    last = Order.objects.select_for_update().filter(created_at__date=today).aggregate(highest=Max("number"))["highest"]
    return (last or 0) + 1


def _locked(order_id) -> Order:
    order = Order.objects.select_for_update().filter(pk=order_id).first()
    if order is None:
        raise ValidationError({"detail": "This order no longer exists."})
    return order


def _assert_open(order: Order) -> None:
    """Still at its table: open, or billed and waiting to be paid."""
    if order.status not in SEATED:
        raise ValidationError({"detail": "This order is closed.", "code": "order_closed"})


def _unbill(order: Order) -> None:
    """A change after the bill was printed makes that bill wrong: the order is open again."""
    if order.status == OrderStatus.BILLED:
        order.status = OrderStatus.OPEN
        order.billed_at = None
        order.save(update_fields=["status", "billed_at", "updated_at"])


def _assert_table_free(table: Table, exclude: Order | None = None) -> None:
    busy = Order.objects.filter(table=table, status__in=SEATED)
    if exclude is not None:
        busy = busy.exclude(pk=exclude.pk)
    if busy.exists():
        raise ValidationError({"table": [f"Table {table.label} already has an open order."]})


@transaction.atomic
def open_order(*, user: User, order_id, table: Table | None, guests: int, type: str, channel: str) -> Order:
    """Open an order, or return the one this id already made (a retried request)."""
    existing = Order.objects.filter(pk=order_id).first()
    if existing is not None:
        return existing
    if table is not None:
        _assert_table_free(table)
    try:
        with transaction.atomic():
            order = Order.objects.create(
                id=order_id,
                number=_next_number(),
                table=table,
                table_label=table.label if table else "",
                guests=guests,
                type=type,
                channel=channel,
                opened_by=user,
            )
    except IntegrityError as exc:
        raise ValidationError({"table": ["Another tablet just opened this table. Refresh the floor."]}) from exc
    if table is not None and table.needs_cleaning:
        table.needs_cleaning = False
        table.save(update_fields=["needs_cleaning", "updated_at"])
    _changed(order)
    return order


@dataclass
class LineInput:
    id: object
    product: Product
    quantity: int
    modifier_ids: list
    note: str
    seat: int | None


def _modifier_snapshot(product: Product, modifier_ids: list) -> tuple[list[dict], int]:
    """Check the picks against the product's groups; return their snapshot and price change."""
    chosen = {str(mid) for mid in modifier_ids}
    snapshot, delta, used = [], 0, set()
    for group in product.modifier_groups.all():
        picked = [option for option in group.options.all() if str(option.pk) in chosen]
        if len(picked) < group.min_select:
            raise ValidationError({"modifiers": [f"{product.name}: choose {group.name}."]})
        if len(picked) > group.max_select:
            raise ValidationError({"modifiers": [f"{product.name}: at most {group.max_select} for {group.name}."]})
        for option in picked:
            snapshot.append({"group": group.name, "name": option.name, "price_delta": option.price_delta})
            delta += option.price_delta
            used.add(str(option.pk))
    if chosen - used:
        raise ValidationError({"modifiers": [f"{product.name}: an option does not belong to this item."]})
    return snapshot, delta


@transaction.atomic
def add_lines(*, user: User, order_id, lines: list[LineInput], send: bool) -> Order:
    order = _locked(order_id)
    _assert_open(order)
    known = set(OrderLine.objects.filter(pk__in=[line.id for line in lines]).values_list("pk", flat=True))
    created = []
    for line in lines:
        if line.id in known:
            continue  # Already saved by an earlier attempt of this request.
        product = line.product
        if product.kind == ProductKind.INGREDIENT or not product.is_active:
            raise ValidationError({"lines": [f"{product.name} is not for sale."]})
        if not product.is_available:
            raise ValidationError({"lines": [f"{product.name} is sold out."], "code": "sold_out"})
        if line.seat is not None and not 1 <= line.seat <= max(order.guests, 1):
            raise ValidationError({"lines": [f"Seat {line.seat} is not at this table."]})
        modifiers, delta = _modifier_snapshot(product, line.modifier_ids)
        created.append(
            OrderLine.objects.create(
                id=line.id,
                order=order,
                product=product,
                name=product.name,
                unit_price=max(0, product.price + delta),
                quantity=line.quantity,
                modifiers=modifiers,
                note=line.note.strip(),
                seat=line.seat,
                station=product.category.station if product.category else "none",
                tax_category=product.tax_category,
                added_by=user,
            )
        )
    if created:
        _unbill(order)
    if send and created:
        _send(order, user, created)
    _changed(order)
    return order


def _send(order: Order, user: User, lines: list[OrderLine]) -> list[PrintJob]:
    now = timezone.now()
    for line in lines:
        line.status = LineStatus.SENT
        line.sent_at = now
    OrderLine.objects.bulk_update(lines, ["status", "sent_at"])
    inventory.deduct_sale(order=order, lines=lines, user=user)
    return _queue_tickets(order, user, lines, JobKind.KITCHEN)


def _queue_tickets(order: Order, user: User, lines: list[OrderLine], kind: str) -> list[PrintJob]:
    """One job per station; lines for "none" (the snack bar) never print in the kitchen."""
    by_station: dict[str, list[OrderLine]] = defaultdict(list)
    for line in lines:
        if line.station != "none":
            by_station[line.station].append(line)
    jobs = [
        PrintJob.objects.create(
            station=station,
            kind=kind,
            order=order,
            created_by=user,
            payload=ticket_payload(order, station_lines, station=station, kind=kind, by=user),
        )
        for station, station_lines in by_station.items()
    ]
    for job in jobs:
        publish("print", {"type": "print.job", "id": str(job.pk), "station": job.station})
    return jobs


@transaction.atomic
def send_held(*, user: User, order_id, line_ids: list | None = None) -> Order:
    order = _locked(order_id)
    _assert_open(order)
    held = order.lines.filter(status=LineStatus.HELD)
    if line_ids is not None:
        held = held.filter(pk__in=line_ids)
    lines = list(held)
    if not lines:
        raise ValidationError({"detail": "Nothing is waiting to be sent."})
    _unbill(order)
    _send(order, user, lines)
    _changed(order)
    return order


@transaction.atomic
def update_held_line(*, order_id, line_id, quantity=None, note=None, seat=None) -> Order:
    order = _locked(order_id)
    _assert_open(order)
    line = order.lines.filter(pk=line_id).first()
    if line is None:
        raise ValidationError({"detail": "This line no longer exists."})
    if line.status != LineStatus.HELD:
        raise ValidationError({"detail": "Sent items can only be voided."})
    _unbill(order)
    if quantity is not None:
        line.quantity = quantity
    if note is not None:
        line.note = note.strip()
    if seat is not None:
        line.seat = seat or None
    line.save()
    _changed(order, floor=False)
    return order


def check_approver(*, approver_id, pin: str) -> User:
    """The manager approving on someone else's tablet session, by their own PIN."""
    approver = User.objects.filter(pk=approver_id, is_active=True).first()
    if approver is None or not approver.has_perm(APPROVE):
        raise ApprovalRejected("This person cannot approve.")
    if approver.pin_locked():
        raise ApprovalRejected("Too many wrong PINs. Ask another manager.")
    if not approver.check_pin(pin):
        raise ApprovalRejected("PIN is incorrect.")
    return approver


@transaction.atomic
def void_line(*, user: User, order_id, line_id, reason: str, approver: User | None) -> tuple[Order, OrderLine, User]:
    """
    Remove a held line, or void a sent one. Voiding something the kitchen
    already has needs accounts.void_sent_item, or a manager's PIN, and prints
    a cancellation ticket at its station.
    """
    order = _locked(order_id)
    _assert_open(order)
    line = order.lines.filter(pk=line_id).first()
    if line is None or line.status == LineStatus.VOID:
        raise ValidationError({"detail": "This line is already gone."})
    if line.payment_id:
        raise ValidationError({"detail": "This item is already paid."})
    _unbill(order)
    if line.status == LineStatus.HELD:
        line.delete()
        _changed(order, floor=False)
        return order, line, user
    if not reason.strip():
        raise ValidationError({"reason": ["Say why it is voided."]})
    authorised_by = user if user.has_perm(VOID_SENT) else approver
    if authorised_by is None:
        raise ApprovalRequired()
    line.status = LineStatus.VOID
    line.voided_at = timezone.now()
    line.voided_by = authorised_by
    line.void_reason = reason.strip()
    line.save()
    inventory.return_void(order=order, line=line, user=user)
    _queue_tickets(order, user, [line], JobKind.VOID)
    _changed(order)
    return order, line, authorised_by


@transaction.atomic
def move_order(*, order_id, table: Table) -> Order:
    order = _locked(order_id)
    _assert_open(order)
    if order.table_id == table.pk:
        return order
    _assert_table_free(table, exclude=order)
    previous = order.table
    order.table = table
    order.table_label = table.label
    order.save(update_fields=["table", "table_label", "updated_at"])
    if previous is not None:
        previous.needs_cleaning = True
        previous.save(update_fields=["needs_cleaning", "updated_at"])
    _changed(order)
    return order


@transaction.atomic
def merge_orders(*, target_id, source_id) -> Order:
    """Bring another table's order into this one; the other table is left to be cleaned."""
    if str(target_id) == str(source_id):
        raise ValidationError({"detail": "Pick another table to merge."})
    target = _locked(target_id)
    source = _locked(source_id)
    _assert_open(target)
    _assert_open(source)
    _unbill(target)
    source.lines.update(order=target)
    target.guests += source.guests
    target.save(update_fields=["guests", "updated_at"])
    source.status = OrderStatus.MERGED
    source.merged_into = target
    source.closed_at = timezone.now()
    source.save(update_fields=["status", "merged_into", "closed_at", "updated_at"])
    if source.table is not None:
        source.table.needs_cleaning = True
        source.table.save(update_fields=["needs_cleaning", "updated_at"])
    _changed(source)
    _changed(target)
    return target


@transaction.atomic
def cancel_order(*, order_id) -> Order:
    """An order opened by mistake. Anything already sent must be voided first."""
    order = _locked(order_id)
    _assert_open(order)
    if order.lines.filter(status=LineStatus.SENT).exists():
        raise ValidationError({"detail": "Void the sent items first."})
    order.lines.all().delete()
    order.status = OrderStatus.VOID
    order.closed_at = timezone.now()
    order.save(update_fields=["status", "closed_at", "updated_at"])
    _changed(order)
    return order


@transaction.atomic
def set_guests(*, order_id, guests: int) -> Order:
    order = _locked(order_id)
    _assert_open(order)
    order.guests = guests
    order.save(update_fields=["guests", "updated_at"])
    _changed(order)
    return order
