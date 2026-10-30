"""
The cash drawer. A shift starts with counted opening cash; every cash
payment, cash-in and cash-out moves the expected amount; closing compares
it with what is counted and keeps the difference.
"""

from django.conf import settings
from django.db import models
from django.db.models import Q, Sum
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel


class Shift(BaseModel):
    opened_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    opening_cash = models.PositiveIntegerField(_("opening cash"))
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    closed_at = models.DateTimeField(_("closed at"), null=True, blank=True)
    counted_cash = models.PositiveIntegerField(_("counted cash"), null=True, blank=True)
    # Frozen at close, so later corrections never rewrite what the cashier was told.
    expected_cash = models.IntegerField(_("expected cash"), null=True, blank=True)
    note = models.CharField(_("note"), max_length=200, blank=True, default="")

    class Meta:
        verbose_name = _("shift")
        verbose_name_plural = _("shifts")
        ordering = ("-created_at",)
        constraints = [
            # One drawer, so one open shift at a time.
            models.UniqueConstraint(fields=["closed_at"], condition=Q(closed_at__isnull=True), name="shift_one_open")
        ]

    def __str__(self):
        return f"Shift {self.created_at:%Y-%m-%d %H:%M}"

    @property
    def is_open(self) -> bool:
        return self.closed_at is None

    def totals(self) -> dict:
        cash_sales = self.payments.filter(method="cash").aggregate(total=Sum("amount"))["total"] or 0
        other_sales = self.payments.exclude(method="cash").aggregate(total=Sum("amount"))["total"] or 0
        cash_in = self.movements.filter(kind=MovementKind.IN).aggregate(total=Sum("amount"))["total"] or 0
        cash_out = self.movements.filter(kind=MovementKind.OUT).aggregate(total=Sum("amount"))["total"] or 0
        expected = self.opening_cash + cash_sales + cash_in - cash_out
        return {
            "cash_sales": cash_sales,
            "other_sales": other_sales,
            "cash_in": cash_in,
            "cash_out": cash_out,
            "expected_cash": expected,
            "payments": self.payments.count(),
        }


class MovementKind(models.TextChoices):
    IN = "in", _("Cash in")
    OUT = "out", _("Cash out")


class CashMovement(BaseModel):
    shift = models.ForeignKey(Shift, on_delete=models.PROTECT, related_name="movements")
    kind = models.CharField(_("kind"), max_length=4, choices=MovementKind.choices)
    amount = models.PositiveIntegerField(_("amount"))
    reason = models.CharField(_("reason"), max_length=120)
    by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")

    class Meta:
        verbose_name = _("cash movement")
        verbose_name_plural = _("cash movements")
        ordering = ("created_at",)
