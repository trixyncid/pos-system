"""
The bill, computed one way everywhere. The frontend's billTotals()
(frontend/src/lib/money.ts) follows the same order and rounding, so the
tablet and the receipt always show the same numbers:

    subtotal → discount → service charge → PBJT → cash rounding
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from decimal import ROUND_HALF_UP, Decimal

from outlet.models import Outlet, TaxBase


def percent_of(amount: int, percent) -> int:
    """`amount * percent / 100`, rounded half-up to a whole rupiah."""
    return int((Decimal(amount) * Decimal(str(percent)) / 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def round_cash(amount: int, unit: int) -> int:
    """To the nearest `unit`, halves up (Rp100: 20.350 → 20.400)."""
    if unit <= 1:
        return amount
    return int((Decimal(amount) / unit).quantize(Decimal(1), rounding=ROUND_HALF_UP)) * unit


@dataclass(frozen=True)
class Bill:
    subtotal: int
    discount: int
    service: int
    tax: int
    rounding: int
    total: int

    def as_dict(self) -> dict:
        return asdict(self)


def share_of(amount: int, part: int, whole: int) -> int:
    """`amount * part / whole`, rounded half-up: a proportional slice of a whole-rupiah amount."""
    if not whole:
        return 0
    return int((Decimal(amount) * part / whole).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def compute(subtotal: int, discount: int, outlet: Outlet, *, service: bool = True, taxable: int | None = None) -> Bill:
    """
    `service=False` for counter sales (no table service). `taxable` is the
    part of the subtotal PBJT applies to (lines whose product is PBJT;
    retail goods under PPN or none are not charged it); default all of it.
    """
    after_discount = max(0, subtotal - discount)
    service_charge = percent_of(after_discount, outlet.service_percent) if service else 0
    base = after_discount + service_charge if outlet.tax_base == TaxBase.SUBTOTAL_WITH_SERVICE else after_discount
    if taxable is not None and taxable < subtotal:
        base = share_of(base, taxable, subtotal)
    tax = percent_of(base, outlet.pbjt_percent)
    before = after_discount + service_charge + tax
    total = round_cash(before, outlet.cash_rounding)
    return Bill(
        subtotal=subtotal,
        discount=subtotal - after_discount,
        service=service_charge,
        tax=tax,
        rounding=total - before,
        total=total,
    )


def order_discount(order, subtotal: int) -> int:
    from orders.models import DiscountKind

    if order.discount_kind == DiscountKind.PERCENT:
        return min(subtotal, percent_of(subtotal, order.discount_value))
    if order.discount_kind == DiscountKind.AMOUNT:
        return min(subtotal, order.discount_value)
    return 0


def _live(order) -> list:
    # .all() so a prefetch (the order serializer's) is used rather than a new query.
    return [line for line in order.lines.all() if line.status != "void"]


def _bill_for(order, lines, discount: int, outlet: Outlet) -> Bill:
    from catalog.models import TaxCategory
    from orders.models import Channel

    return compute(
        sum(line.total for line in lines),
        discount,
        outlet,
        service=order.channel != Channel.SNACKBAR,
        taxable=sum(line.total for line in lines if line.tax_category == TaxCategory.PBJT),
    )


def order_bill(order, outlet: Outlet | None = None) -> Bill:
    lines = _live(order)
    subtotal = sum(line.total for line in lines)
    return _bill_for(order, lines, order_discount(order, subtotal), outlet or Outlet.load())


def lines_bill(order, lines, outlet: Outlet | None = None) -> Bill:
    """The share of the bill for some lines: the order's discount is spread in proportion."""
    whole = sum(line.total for line in _live(order))
    part = sum(line.total for line in lines)
    discount = share_of(order_discount(order, whole), part, whole)
    return _bill_for(order, lines, discount, outlet or Outlet.load())
