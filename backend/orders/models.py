"""
Orders and their lines. Tablets create both with their own UUIDs, so a
retried request finds the row it already made instead of adding another.
Prices, names and modifiers are copied onto each line when it is ordered:
a later menu change never rewrites a bill.
"""

from django.conf import settings
from django.db import models
from django.db.models import Q, Sum
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel


class Channel(models.TextChoices):
    RESTAURANT = "restaurant", _("Restaurant")
    SNACKBAR = "snackbar", _("Snack bar")


class OrderType(models.TextChoices):
    DINE_IN = "dine_in", _("Dine in")
    TAKEAWAY = "takeaway", _("Takeaway")


class OrderStatus(models.TextChoices):
    OPEN = "open", _("Open")
    BILLED = "billed", _("Bill printed")
    PAID = "paid", _("Paid")
    MERGED = "merged", _("Merged into another order")
    VOID = "void", _("Cancelled")


class DiscountKind(models.TextChoices):
    NONE = "none", _("None")
    PERCENT = "percent", _("Percent")
    AMOUNT = "amount", _("Amount")


#: Orders that still hold their table.
SEATED = (OrderStatus.OPEN, OrderStatus.BILLED)


class Order(BaseModel):
    number = models.PositiveIntegerField(_("number"), help_text=_("Daily running number, printed on tickets."))
    channel = models.CharField(_("channel"), max_length=16, choices=Channel.choices, default=Channel.RESTAURANT)
    type = models.CharField(_("type"), max_length=16, choices=OrderType.choices, default=OrderType.DINE_IN)
    table = models.ForeignKey(
        "floor.Table", on_delete=models.SET_NULL, null=True, blank=True, related_name="orders", verbose_name=_("table")
    )
    # Kept on the order, so history still says "Meja 7" after the floor plan changes.
    table_label = models.CharField(_("table label"), max_length=12, blank=True, default="")
    guests = models.PositiveSmallIntegerField(_("guests"), default=1)
    status = models.CharField(
        _("status"), max_length=16, choices=OrderStatus.choices, default=OrderStatus.OPEN, db_index=True
    )
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+", verbose_name=_("opened by")
    )
    note = models.CharField(_("note"), max_length=200, blank=True, default="")
    merged_into = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="merged_from",
        verbose_name=_("merged into"),
    )
    closed_at = models.DateTimeField(_("closed at"), null=True, blank=True)
    billed_at = models.DateTimeField(_("bill printed at"), null=True, blank=True)
    discount_kind = models.CharField(
        _("discount"), max_length=8, choices=DiscountKind.choices, default=DiscountKind.NONE
    )
    discount_value = models.PositiveIntegerField(
        _("discount value"), default=0, help_text=_("Percent for a percent discount, rupiah for an amount.")
    )
    discount_reason = models.CharField(_("discount reason"), max_length=120, blank=True, default="")
    discount_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    discount_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    # Bumped on every change, so a tablet can tell its copy is stale.
    version = models.PositiveIntegerField(_("version"), default=1)

    class Meta:
        verbose_name = _("order")
        verbose_name_plural = _("orders")
        ordering = ("-created_at",)
        constraints = [
            # One open order per table at a time.
            models.UniqueConstraint(
                fields=["table"],
                condition=Q(status__in=["open", "billed"], table__isnull=False),
                name="order_one_open_per_table",
            ),
        ]

    def __str__(self):
        return f"#{self.number}"

    def subtotal(self) -> int:
        lines = self.lines.exclude(status=LineStatus.VOID)
        return sum(line.quantity * line.unit_price for line in lines)

    def bump(self) -> None:
        self.version = models.F("version") + 1
        self.save(update_fields=["version", "updated_at"])
        self.refresh_from_db(fields=["version"])


class LineStatus(models.TextChoices):
    HELD = "held", _("Held")
    SENT = "sent", _("Sent to kitchen")
    VOID = "void", _("Voided")


class OrderLine(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="lines", verbose_name=_("order"))
    product = models.ForeignKey(
        "catalog.Product", on_delete=models.PROTECT, related_name="+", verbose_name=_("product")
    )
    name = models.CharField(_("name"), max_length=120)
    unit_price = models.PositiveIntegerField(_("unit price"), help_text=_("Product price plus modifier changes."))
    quantity = models.PositiveSmallIntegerField(_("quantity"), default=1)
    modifiers = models.JSONField(_("modifiers"), default=list, blank=True)
    note = models.CharField(_("note"), max_length=200, blank=True, default="")
    seat = models.PositiveSmallIntegerField(_("seat"), null=True, blank=True)
    station = models.CharField(_("prints at"), max_length=16)
    # Snapshot of the product's tax category: PBJT is charged only on PBJT lines.
    tax_category = models.CharField(_("tax"), max_length=8, default="pbjt")
    status = models.CharField(_("status"), max_length=8, choices=LineStatus.choices, default=LineStatus.HELD)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+", verbose_name=_("added by")
    )
    sent_at = models.DateTimeField(_("sent at"), null=True, blank=True)
    # Set when this line was paid on its own (split by item).
    payment = models.ForeignKey(
        "payments.Payment", on_delete=models.SET_NULL, null=True, blank=True, related_name="lines"
    )
    voided_at = models.DateTimeField(_("voided at"), null=True, blank=True)
    voided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        verbose_name=_("voided by"),
    )
    void_reason = models.CharField(_("void reason"), max_length=120, blank=True, default="")

    class Meta:
        verbose_name = _("order line")
        verbose_name_plural = _("order lines")
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.quantity}× {self.name}"

    @property
    def total(self) -> int:
        return self.quantity * self.unit_price


def order_subtotals(orders):
    """{order_id: subtotal} for many orders in one query, voided lines left out."""
    rows = (
        OrderLine.objects.filter(order__in=orders)
        .exclude(status=LineStatus.VOID)
        .values("order_id")
        .annotate(total=Sum(models.F("quantity") * models.F("unit_price")))
    )
    return {row["order_id"]: row["total"] or 0 for row in rows}
