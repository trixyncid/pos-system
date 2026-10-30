"""
Whether a promo can be used right now, and what it takes off a bill. The
mock API (frontend/src/mocks/db/promos.ts) follows the same rules.
"""

from __future__ import annotations

from datetime import datetime

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from payments.billing import percent_of
from promos.models import Benefit, Promo, PromoChannel, PromoKind


def unavailable_reason(promo: Promo, *, channel: str, now: datetime | None = None) -> str | None:
    """None when the promo is on right now for this channel; otherwise a short reason code."""
    now = timezone.localtime(now or timezone.now())
    if not promo.is_active:
        return "inactive"
    if promo.channel != PromoChannel.ALL and promo.channel != channel:
        return "channel"
    today = now.date()
    if promo.starts_on and today < promo.starts_on:
        return "not_started"
    if promo.ends_on and today > promo.ends_on:
        return "ended"
    if promo.weekdays and today.weekday() not in promo.weekdays:
        return "day"
    if promo.starts_at and promo.ends_at:
        clock = now.time()
        start, end = promo.starts_at, promo.ends_at
        # A window past midnight (22:00–02:00) wraps around.
        inside = start <= clock < end if start < end else clock >= start or clock < end
        if not inside:
            return "time"
    return None


def _covers(promo: Promo, product) -> bool:
    product_ids = {p.pk for p in promo.products.all()}
    category_ids = {c.pk for c in promo.categories.all()}
    return product.pk in product_ids or (product.category_id is not None and product.category_id in category_ids)


def discount(promo: Promo, lines) -> int:
    """What the promo takes off these lines, before service and tax. 0 when the bill doesn't qualify."""
    subtotal = sum(line.total for line in lines)
    if not subtotal or subtotal < promo.min_spend:
        return 0
    if promo.kind == PromoKind.BILL:
        off = percent_of(subtotal, promo.value) if promo.benefit == Benefit.PERCENT else promo.value
    elif promo.kind == PromoKind.ITEMS:
        off = 0
        for line in lines:
            if not _covers(promo, line.product):
                continue
            if promo.benefit == Benefit.PERCENT:
                each = percent_of(line.unit_price, promo.value)
            elif promo.benefit == Benefit.AMOUNT:
                each = min(promo.value, line.unit_price)
            else:  # A promo price: the difference, never a surcharge.
                each = max(0, line.unit_price - promo.value)
            off += each * line.quantity
    else:
        # Buy X get Y: in every group of X+Y covered units, the Y cheapest come off by `value` percent.
        units = sorted(
            (line.unit_price for line in lines if _covers(promo, line.product) for _ in range(line.quantity)),
            reverse=True,
        )
        group = (promo.buy_quantity or 1) + (promo.get_quantity or 1)
        free = (len(units) // group) * (promo.get_quantity or 1)
        off = sum(percent_of(price, promo.value) for price in units[len(units) - free :]) if free else 0
    if promo.max_discount is not None:
        off = min(off, promo.max_discount)
    return min(off, subtotal)


def live_lines(order) -> list:
    return [line for line in order.lines.all() if line.status != "void"]


@transaction.atomic
def apply(*, order_id, promo: Promo | None):
    """Put a promo on an open bill, replacing any manual discount, or take it off (promo=None)."""
    from orders.models import DiscountKind
    from orders.services import _assert_open, _changed, _locked, _unbill

    order = _locked(order_id)
    _assert_open(order)
    if order.payments.exists():
        raise ValidationError({"detail": "Part of this bill is paid; the discount can no longer change."})
    if promo is not None:
        reason = unavailable_reason(promo, channel=order.channel)
        if reason:
            raise ValidationError({"promo": [f"This promo isn't available now ({reason})."], "code": reason})
        if discount(promo, live_lines(order)) <= 0:
            raise ValidationError({"promo": ["This bill doesn't qualify for the promo."]})
    order.promo = promo
    order.promo_name = promo.name if promo else ""
    # One discount per bill: a promo replaces a manual discount.
    if promo is not None:
        order.discount_kind = DiscountKind.NONE
        order.discount_value = 0
        order.discount_reason = ""
        order.discount_by = None
        order.discount_approved_by = None
    _unbill(order)
    order.save()
    _changed(order)
    return order
