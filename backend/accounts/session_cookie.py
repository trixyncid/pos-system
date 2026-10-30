"""
The refresh token as an httpOnly cookie for the web app.

The browser keeps the cookie across closed tabs and restarts, and page
scripts cannot read it. A client that does not send the X-Session-Cookie
header (the Capacitor print station, or tests) gets the refresh token in the
response body instead.
"""

from django.conf import settings
from rest_framework.response import Response

COOKIE_HEADER = "X-Session-Cookie"


def wants_cookie(request) -> bool:
    return request.headers.get(COOKIE_HEADER) == "1"


def refresh_from(request) -> tuple[str, bool]:
    """The refresh token sent with this request, and whether it came from the cookie."""
    cookie = (request.COOKIES.get(settings.REFRESH_COOKIE_NAME) or "").strip()
    if cookie:
        return cookie, True
    return str(request.data.get("refresh") or "").strip(), False


def trusted_origin(request) -> bool:
    """
    A cookie request must come from the web app. SameSite=Lax already stops
    other sites; this also stops other subdomains of the same site.
    """
    origin = (request.headers.get("Origin") or "").rstrip("/")
    if not origin or settings.DEBUG:
        return True
    allowed = {(settings.FRONTEND_URL or "").rstrip("/")}
    if settings.DOMAIN:
        allowed.add(f"https://{settings.DOMAIN}")
    return origin in allowed


def set_refresh_cookie(response: Response, refresh: str) -> None:
    lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        refresh,
        max_age=int(lifetime.total_seconds()),
        path=settings.REFRESH_COOKIE_PATH,
        secure=settings.REFRESH_COOKIE_SECURE,
        httponly=True,
        samesite="Lax",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(settings.REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH, samesite="Lax")


def session_response(request, payload: dict, status: int = 200) -> Response:
    """A sign-in response. For the web app the refresh token moves from the body into the cookie."""
    if not wants_cookie(request):
        return Response(payload, status=status)
    body = {key: value for key, value in payload.items() if key != "refresh"}
    response = Response(body, status=status)
    set_refresh_cookie(response, payload["refresh"])
    return response
