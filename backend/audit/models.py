"""
Append-only record of sensitive actions: sign-ins, voids, discounts, price
changes, reprints and cash outs. Rows are never updated or deleted through
the ORM.
"""

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class AuditEventQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise PermissionError("AuditEvent rows are append-only and cannot be updated.")

    def delete(self):
        raise PermissionError("AuditEvent rows are append-only and cannot be deleted.")


class AuditEventManager(models.Manager.from_queryset(AuditEventQuerySet)):
    def bulk_update(self, *args, **kwargs):
        raise PermissionError("AuditEvent rows are append-only and cannot be updated.")


class AuditEvent(models.Model):
    created_at = models.DateTimeField(_("created at"), auto_now_add=True, db_index=True)
    # Deleting a user must not rewrite history, so the id is kept without a database constraint.
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.DO_NOTHING,
        db_constraint=False,
        null=True,
        blank=True,
        related_name="+",
        verbose_name=_("actor"),
    )
    actor_name = models.CharField(_("actor name"), max_length=150, blank=True, default="")
    action = models.CharField(
        _("action"), max_length=64, db_index=True, help_text=_("Dotted name, e.g. order.void_item.")
    )
    target_type = models.CharField(_("target type"), max_length=64, blank=True, default="")
    target_id = models.CharField(_("target id"), max_length=64, blank=True, default="")
    target_label = models.CharField(_("target label"), max_length=255, blank=True, default="")
    ip_address = models.GenericIPAddressField(_("IP address"), null=True, blank=True)
    user_agent = models.CharField(_("user agent"), max_length=512, blank=True, default="")
    metadata = models.JSONField(_("metadata"), default=dict, blank=True)

    objects = AuditEventManager()

    class Meta:
        verbose_name = _("audit event")
        verbose_name_plural = _("audit events")
        ordering = ("-created_at", "-id")
        indexes = [
            models.Index(fields=["action", "created_at"], name="audit_action_created"),
            models.Index(fields=["target_type", "target_id"], name="audit_target"),
            models.Index(fields=["actor", "created_at"], name="audit_actor_created"),
        ]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.action} {self.target_type}:{self.target_id}"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise PermissionError("AuditEvent rows are append-only and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("AuditEvent rows are append-only and cannot be deleted.")
