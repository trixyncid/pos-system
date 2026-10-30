from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import AbstractUser, Group
from django.core.validators import RegexValidator
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from accounts.managers import UserManager

pin_validator = RegexValidator(r"^\d{4,6}$", _("PIN must be 4 to 6 digits."))


class User(AbstractUser):
    """
    A staff account. Managers and owners sign a tablet in with email and
    password; every staff member then unlocks it with their own PIN, so each
    order, void and payment is recorded against the person who made it.
    """

    username = None
    first_name = None
    last_name = None

    # Optional: floor staff often work by PIN only. Without an email an account
    # cannot sign a tablet in, only unlock one.
    email = models.EmailField(_("email"), unique=True, null=True, blank=True)
    full_name = models.CharField(_("full name"), max_length=150)
    # Hashed like a password. Never stored or logged as digits.
    pin_hash = models.CharField(_("PIN hash"), max_length=128, blank=True, editable=False)
    pin_failed_attempts = models.PositiveSmallIntegerField(_("failed PIN attempts"), default=0, editable=False)
    pin_locked_until = models.DateTimeField(_("PIN locked until"), null=True, blank=True, editable=False)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    objects = UserManager()

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")
        ordering = ("full_name",)

    def __str__(self):
        return self.full_name or self.email or f"User {self.pk}"

    # --- PIN -----------------------------------------------------------------

    @property
    def has_pin(self) -> bool:
        return bool(self.pin_hash)

    def set_pin(self, pin: str) -> None:
        pin_validator(pin)
        self.pin_hash = make_password(pin)
        self.pin_failed_attempts = 0
        self.pin_locked_until = None

    def pin_locked(self) -> bool:
        return self.pin_locked_until is not None and self.pin_locked_until > timezone.now()

    def check_pin(self, pin: str) -> bool:
        """
        True when `pin` matches. A wrong PIN counts towards a temporary lock,
        so four digits cannot be guessed by trying them all. Saves the counters.
        """
        if not self.has_pin or self.pin_locked():
            return False
        if check_password(pin, self.pin_hash):
            if self.pin_failed_attempts:
                self.pin_failed_attempts = 0
                self.pin_locked_until = None
                self.save(update_fields=["pin_failed_attempts", "pin_locked_until"])
            return True
        self.pin_failed_attempts += 1
        if self.pin_failed_attempts >= settings.PIN_MAX_ATTEMPTS:
            self.pin_failed_attempts = 0
            self.pin_locked_until = timezone.now() + timedelta(minutes=settings.PIN_LOCK_MINUTES)
        self.save(update_fields=["pin_failed_attempts", "pin_locked_until"])
        return False


class GroupProfile(models.Model):
    """
    Stable metadata for a role. A role is a Django Group, and its actions are
    ordinary Django permissions, so an owner can build any role from the
    permission catalog.
    """

    group = models.OneToOneField(Group, on_delete=models.CASCADE, related_name="profile")
    code = models.SlugField(_("code"), max_length=64, unique=True, help_text=_("Stable id, e.g. cashier."))
    description = models.TextField(_("description"), blank=True, default="")
    is_system = models.BooleanField(
        _("system role"), default=False, help_text=_("Seeded role; its code cannot change.")
    )
    created_at = models.DateTimeField(_("created at"), auto_now_add=True)
    updated_at = models.DateTimeField(_("updated at"), auto_now=True)

    class Meta:
        verbose_name = _("role profile")
        verbose_name_plural = _("role profiles")
        default_permissions = ()

    def __str__(self):
        return self.group.name


class PosAccess(GroupProfile):
    """
    POS actions that are not plain create/read/update/delete on a model.
    A proxy with no table of its own; it exists to own these permissions.
    """

    class Meta:
        proxy = True
        default_permissions = ()
        verbose_name = _("POS access")
        permissions = [
            ("take_order", "Can take orders"),
            ("void_sent_item", "Can void an item already sent to the kitchen"),
            ("apply_discount", "Can apply a discount"),
            ("approve_override", "Can approve a void or discount with their PIN"),
            ("reprint", "Can reprint a ticket or receipt"),
            ("take_payment", "Can take payment"),
            ("open_drawer", "Can open the cash drawer without a sale"),
            ("open_shift", "Can open a shift"),
            ("close_shift", "Can close a shift"),
            ("edit_floor", "Can edit the floor plan"),
            ("manage_stock", "Can receive, count and write off stock"),
            ("view_dashboard", "Can view the owner dashboard"),
            ("view_reports", "Can view reports"),
            ("manage_staff", "Can manage staff and roles"),
            ("manage_settings", "Can change outlet settings"),
            ("view_audit", "Can view the audit log"),
            ("print_station", "Can run the print station"),
        ]
