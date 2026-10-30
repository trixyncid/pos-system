"""
Print jobs. The API never talks to a printer: it queues a job, the Android
print station receives it on the "print" stream, prints it on the LAN
printer for its station, and reports back.
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel


class JobKind(models.TextChoices):
    KITCHEN = "kitchen", _("Kitchen ticket")
    VOID = "void", _("Cancellation ticket")
    BILL = "bill", _("Bill")
    RECEIPT = "receipt", _("Receipt")
    SHIFT = "shift", _("Shift report")
    TEST = "test", _("Test print")


class JobStatus(models.TextChoices):
    QUEUED = "queued", _("Queued")
    PRINTED = "printed", _("Printed")
    FAILED = "failed", _("Failed")


class PrintJob(BaseModel):
    station = models.CharField(_("station"), max_length=16, db_index=True)
    kind = models.CharField(_("kind"), max_length=16, choices=JobKind.choices)
    status = models.CharField(
        _("status"), max_length=8, choices=JobStatus.choices, default=JobStatus.QUEUED, db_index=True
    )
    # Everything the station needs to lay the ticket out; it never looks anything up.
    payload = models.JSONField(_("payload"))
    order = models.ForeignKey(
        "orders.Order", on_delete=models.SET_NULL, null=True, blank=True, related_name="print_jobs"
    )
    attempts = models.PositiveSmallIntegerField(_("attempts"), default=0)
    error = models.CharField(_("error"), max_length=200, blank=True, default="")
    printed_at = models.DateTimeField(_("printed at"), null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+", verbose_name=_("created by")
    )
    reprint_of = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        verbose_name = _("print job")
        verbose_name_plural = _("print jobs")
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.kind} @ {self.station}"
