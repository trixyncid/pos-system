import re

from django.contrib.auth.base_user import BaseUserManager


def username_from(*sources: str | None) -> str:
    """A lowercase handle from a name or an email ("Sari Lestari" → "sari.lestari")."""
    for source in sources:
        if source:
            base = source.split("@")[0].strip().lower()
            base = re.sub(r"[^a-z0-9._-]+", ".", base).strip("._-")
            if len(base) >= 3:
                return base[:26]
    return "staff"


class UserManager(BaseUserManager):
    """Users sign in with a username; email is optional."""

    use_in_migrations = True

    def unique_username(self, wanted: str) -> str:
        candidate, n = wanted, 1
        while self.model.objects.filter(username=candidate).exists():
            n += 1
            candidate = f"{wanted[:26]}{n}"
        return candidate

    def _create_user(self, email, password, username=None, **extra_fields):
        email = self.normalize_email(email).lower() if email else None
        username = (username or "").strip().lower() or self.unique_username(
            username_from(extra_fields.get("full_name"), email)
        )
        user = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, username=None, password=None, email=None, **extra_fields):
        extra_fields["is_staff"] = True
        extra_fields["is_superuser"] = True
        return self._create_user(email, password, username=username, **extra_fields)
