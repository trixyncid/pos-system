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


def compute(subtotal: int, discount: int, outlet: Outlet) -> Bill:
    after_discount = max(0, subtotal - discount)
    service = percent_of(after_discount, outlet.service_percent)
    taxable = after_discount + service if outlet.tax_base == TaxBase.SUBTOTAL_WITH_SERVICE else after_discount
    tax = percent_of(taxable, outlet.pbjt_percent)
    before = after_discount + service + tax
    total = round_cash(before, outlet.cash_rounding)
    return Bill(
        subtotal=subtotal,
        discount=subtotal - after_discount,
        service=service,
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


def order_bill(order, outlet: Outlet | None = None) -> Bill:
    subtotal = order.subtotal()
    return compute(subtotal, order_discount(order, subtotal), outlet or Outlet.load())


def lines_bill(order, lines, outlet: Outlet | None = None) -> Bill:
    """The share of the bill for some lines: the order's discount is spread in proportion."""
    outlet = outlet or Outlet.load()
    whole = order.subtotal()
    part = sum(line.total for line in lines)
    discount = order_discount(order, whole)
    share = int((Decimal(discount) * part / whole).quantize(Decimal(1), rounding=ROUND_HALF_UP)) if whole else 0
    return compute(part, share, outlet)
