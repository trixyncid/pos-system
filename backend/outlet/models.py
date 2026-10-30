from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel


class TaxBase(models.TextChoices):
    SUBTOTAL = "subtotal", _("Subtotal only")
    SUBTOTAL_WITH_SERVICE = "subtotal_with_service", _("Subtotal plus service charge")


class CashRounding(models.IntegerChoices):
    NONE = 1, _("No rounding")
    HUNDRED = 100, _("Rp100")
    FIVE_HUNDRED = 500, _("Rp500")


class Outlet(BaseModel):
    """
    The restaurant and its snack bar. There is one row; `Outlet.load()` returns
    it. Devices, printers and tax rules hang off it so a second outlet can be
    added later without reshaping the data.
    """

    name = models.CharField(_("name"), max_length=120)
    address = models.TextField(_("address"), blank=True, default="")
    npwpd = models.CharField(
        _("NPWPD"), max_length=40, blank=True, default="", help_text=_("Regional tax id, printed on receipts.")
    )
    pbjt_percent = models.DecimalField(
        _("PBJT %"),
        max_digits=4,
        decimal_places=2,
        default=10,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        help_text=_("Regional restaurant tax set by the regency or city; at most 10%."),
    )
    service_percent = models.DecimalField(
        _("service charge %"),
        max_digits=5,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
    )
    tax_base = models.CharField(
        _("PBJT charged on"), max_length=32, choices=TaxBase.choices, default=TaxBase.SUBTOTAL_WITH_SERVICE
    )
    cash_rounding = models.PositiveSmallIntegerField(
        _("cash rounding"), choices=CashRounding.choices, default=CashRounding.HUNDRED
    )

    class Meta:
        verbose_name = _("outlet")
        verbose_name_plural = _("outlet")

    def __str__(self):
        return self.name

    @classmethod
    def load(cls) -> "Outlet":
        outlet = cls.objects.order_by("created_at").first()
        if outlet is None:
            outlet = cls.objects.create(name="Outlet")
        return outlet
