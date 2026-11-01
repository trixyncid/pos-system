"""
A customer-facing screen (the cashier PC's second monitor, or a tablet facing
the counter). It has no staff login: it registers itself, shows a six-digit
code, and a cashier pairs it by typing that code. From then on it holds a
secret token that only lets it watch its own channel.
"""

import hashlib
import secrets

from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _

from common.models import BaseModel


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


class CustomerDisplay(BaseModel):
    name = models.CharField(_("name"), max_length=60, default="Layar pelanggan")
    # Only the hash is kept; the display holds the token itself.
    token_hash = models.CharField(_("token hash"), max_length=64, unique=True)
    code = models.CharField(
        _("pairing code"), max_length=6, null=True, blank=True, unique=True, help_text=_("Shown until paired.")
    )
    paired_at = models.DateTimeField(_("paired at"), null=True, blank=True)
    paired_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    last_seen = models.DateTimeField(_("last seen"), null=True, blank=True)

    class Meta:
        verbose_name = _("customer display")
        verbose_name_plural = _("customer displays")
        ordering = ("-created_at",)

    def __str__(self):
        return self.name

    @property
    def is_paired(self) -> bool:
        return self.paired_at is not None

    @classmethod
    def register(cls) -> tuple["CustomerDisplay", str]:
        """A new, unpaired display and its token (returned once, never stored)."""
        token = secrets.token_urlsafe(32)
        code = new_code()
        while cls.objects.filter(code=code).exists():
            code = new_code()
        return cls.objects.create(token_hash=hash_token(token), code=code), token

    @classmethod
    def for_token(cls, token: str | None) -> "CustomerDisplay | None":
        if not token:
            return None
        return cls.objects.filter(token_hash=hash_token(token)).first()
