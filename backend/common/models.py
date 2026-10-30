import uuid

from django.db import models
from django.utils.translation import gettext_lazy as _


class BaseModel(models.Model):
    """
    UUID primary key and timestamps for every POS record.

    Tablets create orders, lines and payments with their own UUID v7 before
    the API sees them, so a retried request lands on the same row instead of
    creating a second one.
    """

    id = models.UUIDField(_("id"), primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(_("created at"), auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        abstract = True
        ordering = ("-created_at",)
