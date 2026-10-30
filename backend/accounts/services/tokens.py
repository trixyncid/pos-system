"""Issuing and revoking JWT sessions."""

from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken


def issue_pair(user) -> tuple[str, str]:
    refresh = RefreshToken.for_user(user)
    return str(refresh.access_token), str(refresh)


def revoke_sessions(user) -> None:
    """Blacklist every refresh token so the account is signed out on every tablet."""
    tokens = OutstandingToken.objects.filter(user=user).exclude(blacklistedtoken__isnull=False)
    BlacklistedToken.objects.bulk_create([BlacklistedToken(token=token) for token in tokens], ignore_conflicts=True)
