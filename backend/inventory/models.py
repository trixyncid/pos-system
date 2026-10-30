"""
The stock ledger. Every change to what is on the shelf is a StockMovement;
Product.stock caches the running balance and is only written next to a new
movement, under a row lock, so the two never disagree.
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel


class MovementKind(models.TextChoices):
    SALE = "sale", _("Sale")
    VOID = "void", _("Void returned")
    RECEIVE = "receive", _("Received")
    WASTE = "waste", _("Waste")
    COUNT = "count", _("Stock count")
    REFUND = "refund", _("Refund returned")


class StockMovement(BaseModel):
    product = models.ForeignKey(
        "catalog.Product", on_delete=models.PROTECT, related_name="movements", verbose_name=_("product")
    )
    kind = models.CharField(_("kind"), max_length=8, choices=MovementKind.choices, db_index=True)
    quantity = models.DecimalField(
        _("change"), max_digits=12, decimal_places=3, help_text=_("Negative takes stock out.")
    )
    balance = models.DecimalField(_("on hand after"), max_digits=12, decimal_places=3)
    unit_cost = models.PositiveIntegerField(_("unit cost"), null=True, blank=True)
    reason = models.CharField(_("reason"), max_length=120, blank=True, default="")
    order = models.ForeignKey(
        "orders.Order", on_delete=models.SET_NULL, null=True, blank=True, related_name="+", verbose_name=_("order")
    )
    # One delivery or one stock count: the batch a retried request is recognised by.
    reference = models.UUIDField(_("reference"), null=True, blank=True, db_index=True)
    by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+", verbose_name=_("by"))

    class Meta:
        verbose_name = _("stock movement")
        verbose_name_plural = _("stock movements")
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["product", "-created_at"], name="movement_product_recent")]

    def __str__(self):
        return f"{self.kind} {self.quantity} {self.product_id}"
