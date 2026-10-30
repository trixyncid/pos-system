"""
Promos the owner sets up in advance and the cashier applies at checkout.
A bill carries at most one discount: a promo or a manager's manual one.
"""

from django.db import models
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel


class PromoKind(models.TextChoices):
    BILL = "bill", _("Off the whole bill")
    ITEMS = "items", _("Off chosen items")
    BUNDLE = "bundle", _("Buy X get Y")


class Benefit(models.TextChoices):
    PERCENT = "percent", _("Percent off")
    AMOUNT = "amount", _("Rupiah off")
    PRICE = "price", _("Promo price")


class PromoChannel(models.TextChoices):
    ALL = "all", _("Restaurant and snack bar")
    RESTAURANT = "restaurant", _("Restaurant")
    SNACKBAR = "snackbar", _("Snack bar")


class Promo(BaseModel):
    name = models.CharField(_("name"), max_length=80)
    description = models.CharField(_("description"), max_length=200, blank=True, default="")
    image = models.ImageField(_("banner"), upload_to="promos/", blank=True)
    kind = models.CharField(_("kind"), max_length=8, choices=PromoKind.choices)
    # bill and items: what comes off. bundle: always percent (100 = free).
    benefit = models.CharField(_("benefit"), max_length=8, choices=Benefit.choices, default=Benefit.PERCENT)
    value = models.PositiveIntegerField(
        _("value"), help_text=_("Percent, rupiah off, or the promo price per item, by benefit.")
    )
    max_discount = models.PositiveIntegerField(_("discount cap"), null=True, blank=True)
    min_spend = models.PositiveIntegerField(_("minimum spend"), default=0)
    # items and bundle: which products count. Empty both means none (a promo must say what it covers).
    products = models.ManyToManyField("catalog.Product", blank=True, related_name="promos")
    categories = models.ManyToManyField("catalog.Category", blank=True, related_name="promos")
    buy_quantity = models.PositiveSmallIntegerField(_("buy"), null=True, blank=True)
    get_quantity = models.PositiveSmallIntegerField(_("get"), null=True, blank=True)
    channel = models.CharField(_("channel"), max_length=12, choices=PromoChannel.choices, default=PromoChannel.ALL)
    starts_on = models.DateField(_("from"), null=True, blank=True)
    ends_on = models.DateField(_("until"), null=True, blank=True)
    # 0 = Monday … 6 = Sunday (Python's weekday()); empty means every day.
    weekdays = models.JSONField(_("days"), default=list, blank=True)
    starts_at = models.TimeField(_("from time"), null=True, blank=True)
    ends_at = models.TimeField(_("until time"), null=True, blank=True)
    is_active = models.BooleanField(_("active"), default=True)

    class Meta:
        verbose_name = _("promo")
        verbose_name_plural = _("promos")
        ordering = ("-is_active", "name")

    def __str__(self):
        return self.name
