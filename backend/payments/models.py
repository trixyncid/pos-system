"""
Money received for an order. An order can be paid in several parts (split
by item or evenly); it is paid when the parts reach its total.
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel


class Method(models.TextChoices):
    CASH = "cash", _("Cash")
    QRIS = "qris", _("QRIS")
    CARD = "card", _("Debit/credit card")


# What the tablets offer today. Card stays in the model for later.
PAY_METHODS = (Method.CASH, Method.QRIS)


class Payment(BaseModel):
    """The id comes from the tablet, so a retried payment is recorded once."""

    order = models.ForeignKey("orders.Order", on_delete=models.PROTECT, related_name="payments")
    shift = models.ForeignKey("shifts.Shift", on_delete=models.PROTECT, related_name="payments")
    method = models.CharField(_("method"), max_length=8, choices=Method.choices, default=Method.CASH)
    amount = models.PositiveIntegerField(_("amount"), help_text=_("What this payment settles of the bill."))
    tendered = models.PositiveIntegerField(_("tendered"), help_text=_("What the guest handed over."))
    change = models.PositiveIntegerField(_("change"), default=0)
    received_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")

    class Meta:
        verbose_name = _("payment")
        verbose_name_plural = _("payments")
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.amount} ({self.method})"


class Refund(BaseModel):
    """
    Money given back for a paid order, the same way it was paid: cash out of
    the drawer of the shift that is open, QRIS back to the guest's account.
    """

    order = models.ForeignKey("orders.Order", on_delete=models.PROTECT, related_name="refunds")
    shift = models.ForeignKey("shifts.Shift", on_delete=models.PROTECT, related_name="refunds")
    method = models.CharField(_("method"), max_length=8, choices=Method.choices, default=Method.CASH)
    amount = models.PositiveIntegerField(_("amount"))
    reason = models.CharField(_("reason"), max_length=120)
    by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")

    class Meta:
        verbose_name = _("refund")
        verbose_name_plural = _("refunds")
        ordering = ("created_at",)

    def __str__(self):
        return f"-{self.amount} ({self.method})"
