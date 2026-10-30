"""Sign-in with email and password, PIN unlock on a signed-in tablet, refresh, logout and the current user."""

from django.conf import settings
from django.contrib.auth import authenticate
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import User
from accounts.serializers import LoginSerializer, PinUnlockSerializer, RefreshSerializer, user_payload
from accounts.services.tokens import issue_pair
from accounts.session_cookie import (
    clear_refresh_cookie,
    refresh_from,
    session_response,
    set_refresh_cookie,
    trusted_origin,
    wants_cookie,
)
from accounts.throttles import AuthRateThrottle, PinRateThrottle
from audit.services import emit
from common.responses import ok


def auth_payload(user) -> dict:
    access, refresh = issue_pair(user)
    lifetime = settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"]
    return {
        "success": True,
        "access": access,
        "refresh": refresh,
        "expires_in": int(lifetime.total_seconds()),
        "user": user_payload(user),
    }


def _fail(status: int, detail: str, code: str | None = None) -> Response:
    body = {"success": False, "detail": detail}
    if code:
        body["code"] = code
    return Response(body, status=status)


def _session_over(detail: str = "Your session has ended. Sign in again.") -> Response:
    response = _fail(401, detail, "session_ended")
    clear_refresh_cookie(response)
    return response


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthRateThrottle]

    @extend_schema(request=LoginSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower()
        user = authenticate(request, email=email, password=serializer.validated_data["password"])
        if user is None or not user.is_active:
            emit(request, "auth.login_failed", metadata={"email": email})
            return _fail(401, "Email or password is incorrect.", "invalid_credentials")
        emit(request, "auth.login", actor=user)
        return session_response(request, auth_payload(user))


class PinUnlockView(APIView):
    """
    Hands a signed-in tablet to another staff member. The tablet must already
    hold a session (a manager signed it in); the PIN then picks who is using it.
    A wrong PIN answers 403, not 401, so the client never mistakes it for an
    expired session.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [PinRateThrottle]

    @extend_schema(request=PinUnlockSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        serializer = PinUnlockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = User.objects.filter(pk=serializer.validated_data["user_id"], is_active=True).first()
        if user is None or not user.has_pin:
            return _fail(403, "This staff member cannot unlock with a PIN.", "pin_unavailable")
        if user.pin_locked():
            return _fail(403, "Too many wrong PINs. Ask a manager or try again later.", "pin_locked")
        if not user.check_pin(serializer.validated_data["pin"]):
            emit(request, "auth.pin_failed", target=user)
            if user.pin_locked():
                return _fail(403, "Too many wrong PINs. Ask a manager or try again later.", "pin_locked")
            return _fail(403, "PIN is incorrect.", "pin_incorrect")
        emit(request, "auth.pin_unlock", actor=user)
        return session_response(request, auth_payload(user))


class TokenRefreshView(APIView):
    """
    A new access token, and a new refresh token in place of the one sent (the
    old one is blacklisted). The web app sends its cookie; a native client
    sends the token in the body.
    """

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "token_refresh"

    @extend_schema(request=RefreshSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        raw, from_cookie = refresh_from(request)
        if not raw:
            return _session_over("You are not signed in.")
        if from_cookie and not trusted_origin(request):
            return _fail(403, "This origin may not use the session cookie.")
        serializer = TokenRefreshSerializer(data={"refresh": raw})
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, InvalidToken, AuthenticationFailed):
            return _session_over()
        data = serializer.validated_data
        if from_cookie or wants_cookie(request):
            response = Response({"success": True, "access": data["access"]})
            set_refresh_cookie(response, data.get("refresh", raw))
            return response
        return Response({"success": True, **data})


class LogoutView(APIView):
    """Ends this session: blacklists the refresh token and clears the cookie. Works with an expired access token."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(request=RefreshSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        raw, from_cookie = refresh_from(request)
        if from_cookie and not trusted_origin(request):
            return _fail(403, "This origin may not use the session cookie.")
        if not raw:
            response = _fail(400, "Refresh token is required.")
            clear_refresh_cookie(response)
            return response
        try:
            RefreshToken(raw).blacklist()
        except TokenError:
            response = _fail(401, "Refresh token is not valid.")
        else:
            response = Response({"success": True})
        clear_refresh_cookie(response)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        return ok(user_payload(request.user))


class LockStaffView(APIView):
    """
    The staff tiles on a locked tablet: active users who have a PIN. Only
    names and role names, never emails, so a passer-by learns nothing more
    than the rota on the wall.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        users = User.objects.filter(is_active=True).exclude(pin_hash="").prefetch_related("groups")
        return ok(
            [
                {
                    "id": user.pk,
                    "full_name": user.full_name,
                    "role": ", ".join(group.name for group in user.groups.all()),
                }
                for user in users
            ]
        )


class ApproversView(APIView):
    """Staff who can approve a void or discount with their PIN, for the approval dialog."""

    permission_classes = [IsAuthenticated]

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        users = User.objects.filter(is_active=True).exclude(pin_hash="").prefetch_related("groups")
        approvers = [user for user in users if user.has_perm("accounts.approve_override")]
        return ok([{"id": user.pk, "full_name": user.full_name} for user in approvers])
