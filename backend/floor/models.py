"""
The dining room. Tables sit on a fixed 1000×700 logical canvas per area, so a
layout drawn on one tablet looks the same on every screen size.
"""

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel

CANVAS_WIDTH = 1000
CANVAS_HEIGHT = 700


class Area(BaseModel):
    name = models.CharField(_("name"), max_length=60)
    sort_order = models.PositiveIntegerField(_("sort order"), default=0)
    is_active = models.BooleanField(_("active"), default=True)

    class Meta:
        verbose_name = _("area")
        verbose_name_plural = _("areas")
        ordering = ("sort_order", "name")
        constraints = [models.UniqueConstraint(fields=["name"], name="area_unique_name")]

    def __str__(self):
        return self.name


class TableShape(models.TextChoices):
    RECT = "rect", _("Rectangle")
    ROUND = "round", _("Round")


class Table(BaseModel):
    area = models.ForeignKey(Area, on_delete=models.CASCADE, related_name="tables", verbose_name=_("area"))
    label = models.CharField(_("label"), max_length=12, help_text=_("Printed on tickets, e.g. 7 or T2."))
    shape = models.CharField(_("shape"), max_length=8, choices=TableShape.choices, default=TableShape.RECT)
    x = models.FloatField(_("x"), validators=[MinValueValidator(0), MaxValueValidator(CANVAS_WIDTH)])
    y = models.FloatField(_("y"), validators=[MinValueValidator(0), MaxValueValidator(CANVAS_HEIGHT)])
    width = models.FloatField(_("width"), validators=[MinValueValidator(30), MaxValueValidator(400)])
    height = models.FloatField(_("height"), validators=[MinValueValidator(30), MaxValueValidator(400)])
    rotation = models.FloatField(_("rotation"), default=0, validators=[MinValueValidator(0), MaxValueValidator(360)])
    capacity = models.PositiveSmallIntegerField(_("seats"), default=4, validators=[MinValueValidator(1)])

    class Meta:
        verbose_name = _("table")
        verbose_name_plural = _("tables")
        ordering = ("area__sort_order", "label")
        # Staff call tables by label, and tickets print it, so a label is used once.
        constraints = [models.UniqueConstraint(fields=["label"], name="table_unique_label")]

    def __str__(self):
        return self.label
