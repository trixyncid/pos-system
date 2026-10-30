from django.conf import settings
from django.http import HttpResponse


class FrontendCorsMiddleware:
    """Allow the React origin in FRONTEND_URL to call /api/ with a bearer token and the refresh cookie."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/api/") and request.method == "OPTIONS":
            return self._allow(request, HttpResponse(status=204))
        response = self.get_response(request)
        if request.path.startswith("/api/"):
            return self._allow(request, response)
        return response

    def _allow(self, request, response):
        origin = request.headers.get("Origin", "")
        allowed = (getattr(settings, "FRONTEND_URL", "") or "").rstrip("/")
        if origin and allowed and origin.rstrip("/") == allowed:
            response["Access-Control-Allow-Origin"] = origin
            response["Access-Control-Allow-Headers"] = "Authorization, Content-Type, X-Session-Cookie, Idempotency-Key"
            # The refresh token travels in an httpOnly cookie (accounts/session_cookie.py).
            response["Access-Control-Allow-Credentials"] = "true"
            response["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            # Report downloads carry their filename here; the browser hides it unless exposed.
            response["Access-Control-Expose-Headers"] = "Content-Disposition"
            response["Access-Control-Max-Age"] = "86400"
            response["Vary"] = "Origin"
        return response
