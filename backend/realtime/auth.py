"""
WebSocket authentication with the same access token as the API.

Browsers cannot set an Authorization header on a WebSocket, so the token is
sent as a subprotocol: `new WebSocket(url, ["pos-auth", token])`. It is never
accepted in the query string, where it would end up in proxy logs.
"""

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

SUBPROTOCOL = "pos-auth"


def token_from_scope(scope) -> str | None:
    # The ASGI server parses Sec-WebSocket-Protocol into this list.
    protocols = list(scope.get("subprotocols") or [])
    if len(protocols) == 2 and protocols[0] == SUBPROTOCOL and protocols[1]:
        return protocols[1]
    return None


@database_sync_to_async
def user_for_token(raw: str):
    auth = JWTAuthentication()
    try:
        return auth.get_user(auth.get_validated_token(raw))
    except (InvalidToken, TokenError):
        return AnonymousUser()


class JWTAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        raw = token_from_scope(scope)
        scope = dict(scope, user=await user_for_token(raw) if raw else AnonymousUser())
        return await self.inner(scope, receive, send)
