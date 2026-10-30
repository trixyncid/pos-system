"""
Sales figures from paid orders. Every number goes through the same bill
computation as checkout (payments.billing), so a report never disagrees
with the receipts. Cost uses each item's current cost (its recipe, or its
purchase cost), which is what food-cost % is usually read against; menu
items without a recipe have no known cost and are left out of it.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.db.models import F, Prefetch, Q
from django.utils import timezone

from catalog.models import Product, RecipeLine
from floor.models import Table
from orders.models import Channel, LineStatus, Order, OrderLine, OrderStatus
from outlet.models import Outlet
from payments.billing import order_bill

MAX_DAYS = 92


def day_bounds(start: date, end: date | None = None) -> tuple[datetime, datetime]:
    """Local midnight of `start` to local midnight after `end` (inclusive)."""
    tz = timezone.get_current_timezone()
    return (
        timezone.make_aware(datetime.combine(start, time.min), tz),
        timezone.make_aware(datetime.combine((end or start) + timedelta(days=1), time.min), tz),
    )


def paid_orders(start: datetime, end: datetime):
    recipe = Prefetch("product__recipe", queryset=RecipeLine.objects.select_related("ingredient"))
    lines = Prefetch("lines", queryset=OrderLine.objects.select_related("product").prefetch_related(recipe))
    return (
        Order.objects.filter(status=OrderStatus.PAID, closed_at__gte=start, closed_at__lt=end)
        .select_related("opened_by", "discount_approved_by", "promo")
        .prefetch_related("promo__products", "promo__categories")
        .prefetch_related(lines)
    )


def unit_cost(product: Product) -> Decimal | None:
    """What one unit cost to make or buy; None for a menu item with no recipe and no cost yet."""
    recipe = list(product.recipe.all())
    if recipe:
        return sum((line.quantity * line.ingredient.cost for line in recipe), Decimal(0))
    if product.cost == 0 and product.kind == "menu":
        return None
    return Decimal(product.cost)


@dataclass
class Figures:
    orders: int = 0
    covers: int = 0
    gross: int = 0
    discount: int = 0
    service: int = 0
    tax: int = 0
    rounding: int = 0
    total: int = 0
    cost: Decimal = Decimal(0)

    @property
    def net(self) -> int:
        """Sales the outlet keeps before cost: after discount, without service and tax."""
        return self.gross - self.discount

    def add(self, order, bill, cost: Decimal) -> None:
        self.orders += 1
        if order.channel == Channel.RESTAURANT:
            self.covers += order.guests
        self.gross += bill.subtotal
        self.discount += bill.discount
        self.service += bill.service
        self.tax += bill.tax
        self.rounding += bill.rounding
        self.total += bill.total
        self.cost += cost

    def as_dict(self) -> dict:
        net = self.net
        return {
            "orders": self.orders,
            "covers": self.covers,
            "gross": self.gross,
            "discount": self.discount,
            "service": self.service,
            "tax": self.tax,
            "rounding": self.rounding,
            "sales": self.total,
            "net": net,
            "cost": int(self.cost),
            "food_cost_percent": round(float(self.cost) / net * 100, 1) if net else None,
            "average_ticket": round(self.total / self.orders) if self.orders else 0,
        }


def _line_cost(line) -> Decimal | None:
    cost = unit_cost(line.product)
    return None if cost is None else cost * line.quantity


def _known(costs) -> Decimal:
    return sum((cost for cost in costs if cost is not None), Decimal(0))


def _walk(orders, outlet):
    """Each paid order with its bill, its live lines and what they cost."""
    for order in orders:
        lines = [line for line in order.lines.all() if line.status != LineStatus.VOID]
        costs = {line.pk: _line_cost(line) for line in lines}
        yield order, order_bill(order, outlet), lines, costs


def totals(start: datetime, end: datetime, outlet=None) -> Figures:
    figures = Figures()
    for order, bill, _, costs in _walk(paid_orders(start, end), outlet or Outlet.load()):
        figures.add(order, bill, _known(costs.values()))
    return figures


def dashboard(day: date) -> dict:
    outlet = Outlet.load()
    start, end = day_bounds(day)
    figures = Figures()
    hourly = [0] * 24
    channels = {channel: Figures() for channel in Channel.values}
    items: dict[str, dict] = defaultdict(lambda: {"quantity": 0, "revenue": 0})
    waiters: dict[str, dict] = defaultdict(lambda: {"orders": 0, "sales": 0})
    discounts: dict[str, dict] = defaultdict(lambda: {"count": 0, "amount": 0})
    tables_served = 0

    for order, bill, lines, costs in _walk(paid_orders(start, end), outlet):
        cost = _known(costs.values())
        figures.add(order, bill, cost)
        channels[order.channel].add(order, bill, cost)
        hourly[timezone.localtime(order.closed_at).hour] += bill.total
        if order.table_id or order.table_label:
            tables_served += 1
        waiter = order.opened_by.full_name
        waiters[waiter]["orders"] += 1
        waiters[waiter]["sales"] += bill.total
        if bill.discount and (order.promo_name or order.discount_approved_by):
            # Promos by name; manual discounts by the manager who approved them.
            name = f"Promo · {order.promo_name}" if order.promo_name else order.discount_approved_by.full_name
            discounts[name]["count"] += 1
            discounts[name]["amount"] += bill.discount
        for line in lines:
            items[line.name]["quantity"] += line.quantity
            items[line.name]["revenue"] += line.total

    voids: dict[str, dict] = defaultdict(lambda: {"count": 0, "amount": 0})
    voided = OrderLine.objects.filter(status=LineStatus.VOID, voided_at__gte=start, voided_at__lt=end).select_related(
        "voided_by"
    )
    for line in voided:
        name = line.voided_by.full_name if line.voided_by else "—"
        voids[name]["count"] += 1
        voids[name]["amount"] += line.total

    # A day still in progress is compared with the same hours of the other day, not its whole.
    now = timezone.now()
    cutoff = now - start if start <= now < end else None

    def compare(other: date) -> dict:
        other_start, other_end = day_bounds(other)
        past = totals(other_start, other_start + cutoff if cutoff else other_end, outlet)
        return {"date": other.isoformat(), "sales": past.total, "orders": past.orders, "partial": cutoff is not None}

    tables = Table.objects.count()
    low = Product.objects.filter(track_stock=True, is_active=True).filter(
        Q(stock__lte=0) | Q(low_stock_threshold__isnull=False, stock__lte=F("low_stock_threshold"))
    )

    def ranked(rows: dict, key: str, limit: int | None = None) -> list[dict]:
        ordered = sorted(({"name": name, **row} for name, row in rows.items()), key=lambda r: -r[key])
        return ordered[:limit] if limit else ordered

    return {
        "date": day.isoformat(),
        **figures.as_dict(),
        "yesterday": compare(day - timedelta(days=1)),
        "last_week": compare(day - timedelta(days=7)),
        "hourly": hourly,
        "channels": {channel: channel_figures.as_dict() for channel, channel_figures in channels.items()},
        "top_items": ranked(items, "revenue", 8),
        "waiters": ranked(waiters, "sales"),
        "voids": ranked(voids, "amount"),
        "discounts": ranked(discounts, "amount"),
        "table_turns": round(tables_served / tables, 2) if tables else None,
        "low_stock": low.count(),
    }


def sales_by_day(first: date, last: date) -> list[dict]:
    outlet = Outlet.load()
    start, end = day_bounds(first, last)
    days: dict[date, Figures] = {first + timedelta(days=n): Figures() for n in range((last - first).days + 1)}
    for order, bill, _, costs in _walk(paid_orders(start, end), outlet):
        days[timezone.localtime(order.closed_at).date()].add(order, bill, _known(costs.values()))
    return [{"date": day.isoformat(), **figures.as_dict()} for day, figures in days.items()]


def items_sold(first: date, last: date) -> list[dict]:
    start, end = day_bounds(first, last)
    rows: dict[str, dict] = {}
    for order, _, lines, costs in _walk(paid_orders(start, end), Outlet.load()):
        for line in lines:
            row = rows.setdefault(
                str(line.product_id),
                {
                    "product": str(line.product_id),
                    "name": line.product.name,
                    "kind": line.product.kind,
                    "channel_restaurant": 0,
                    "channel_snackbar": 0,
                    "quantity": 0,
                    "revenue": 0,
                    "cost": Decimal(0),
                },
            )
            row["quantity"] += line.quantity
            row[f"channel_{order.channel}"] += line.quantity
            row["revenue"] += line.total
            cost = costs[line.pk]
            row["cost"] = None if cost is None or row["cost"] is None else row["cost"] + cost
    result = []
    for row in rows.values():
        # Unknown cost (no recipe yet) stays unknown rather than reading as a 100% margin.
        cost = None if row["cost"] is None else int(row["cost"])
        result.append({**row, "cost": cost, "margin": None if cost is None else row["revenue"] - cost})
    return sorted(result, key=lambda r: -r["revenue"])
