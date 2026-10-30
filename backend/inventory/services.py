"""
Everything that changes stock. Sales never block on stock (the shelf is
the truth, the system can be wrong), so on hand may go negative; a count
puts it right.
"""

from __future__ import annotations

from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from catalog.models import Product
from inventory.models import MovementKind, StockMovement


def _locked(product_ids) -> dict:
    # A fixed lock order, so two tablets selling the same items can't deadlock.
    return {
        product.pk: product for product in Product.objects.select_for_update().filter(pk__in=product_ids).order_by("pk")
    }


def _record(product, delta: Decimal, kind: str, user, **extra) -> StockMovement:
    product.stock += delta
    product.save(update_fields=["stock", "updated_at"])
    return StockMovement.objects.create(
        product=product, kind=kind, quantity=delta, balance=product.stock, by=user, **extra
    )


def sale_deltas(lines) -> dict:
    """What some order lines take from stock: tracked items themselves, and recipe ingredients."""
    deltas: dict = defaultdict(Decimal)
    for line in lines:
        product = line.product
        if product.track_stock:
            deltas[product.pk] -= line.quantity
        for recipe_line in product.recipe.all():
            if recipe_line.ingredient.track_stock:
                deltas[recipe_line.ingredient_id] -= recipe_line.quantity * line.quantity
    return deltas


@transaction.atomic
def deduct_sale(*, order, lines, user) -> None:
    deltas = sale_deltas(lines)
    products = _locked(deltas)
    for product_id, delta in deltas.items():
        if delta:
            _record(products[product_id], delta, MovementKind.SALE, user, order=order)


@transaction.atomic
def return_void(*, order, line, user) -> None:
    """A voided item goes back on the shelf; recipe ingredients don't (the food may be made)."""
    if not line.product.track_stock:
        return
    product = _locked([line.product_id])[line.product_id]
    _record(product, Decimal(line.quantity), MovementKind.VOID, user, order=order, reason=line.void_reason)


@transaction.atomic
def return_refund(*, order, lines, user) -> None:
    """A refunded sale puts tracked items back; recipe ingredients stay used, as with a void."""
    deltas: dict = defaultdict(Decimal)
    for line in lines:
        if line.product.track_stock:
            deltas[line.product_id] += line.quantity
    products = _locked(deltas)
    for product_id, delta in deltas.items():
        _record(products[product_id], delta, MovementKind.REFUND, user, order=order, reason=order.refund_reason)


def _tracked(product_ids) -> dict:
    products = _locked(product_ids)
    missing = [str(pk) for pk in product_ids if pk not in products or not products[pk].track_stock]
    if missing:
        raise ValidationError({"lines": ["Some items don't track stock."]})
    return products


@transaction.atomic
def receive(*, user, reference, lines: list[dict], supplier: str = "", note: str = "") -> list[StockMovement]:
    """
    A delivery. Each line's cost moves the product's cost to the weighted
    average of what was on hand and what arrived, so food cost stays honest.
    """
    done = list(StockMovement.objects.filter(reference=reference))
    if done:
        return done  # A retried request.
    products = _tracked([line["product"].pk for line in lines])
    reason = " · ".join(part for part in (supplier.strip(), note.strip()) if part)
    movements = []
    for line in lines:
        product = products[line["product"].pk]
        quantity, unit_cost = line["quantity"], line["unit_cost"]
        on_hand = max(product.stock, Decimal(0))
        if on_hand + quantity > 0:
            average = (on_hand * product.cost + quantity * unit_cost) / (on_hand + quantity)
            product.cost = int(average.quantize(Decimal(1), rounding=ROUND_HALF_UP))
        movements.append(
            _record(
                product, quantity, MovementKind.RECEIVE, user, unit_cost=unit_cost, reason=reason, reference=reference
            )
        )
    Product.objects.bulk_update(products.values(), ["cost"])
    return movements


@transaction.atomic
def waste(*, user, product, quantity: Decimal, reason: str) -> StockMovement:
    product = _tracked([product.pk])[product.pk]
    return _record(product, -quantity, MovementKind.WASTE, user, reason=reason.strip())


@transaction.atomic
def count(*, user, reference, lines: list[dict], note: str = "") -> list[StockMovement]:
    """A stock count (opname): each counted item is set to what is on the shelf; the difference is kept."""
    done = list(StockMovement.objects.filter(reference=reference))
    if done:
        return done
    products = _tracked([line["product"].pk for line in lines])
    movements = []
    for line in lines:
        product = products[line["product"].pk]
        delta = line["counted"] - product.stock
        if delta:
            movements.append(
                _record(product, delta, MovementKind.COUNT, user, reason=note.strip(), reference=reference)
            )
    return movements
