"""
/displays/: a customer display registers itself and reads its own setup with
its token (no staff login); a cashier pairs it and sends it what to show; the
owner sees and removes paired displays in Settings.
"""

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from common.permissions import RequirePermission
from common.responses import fail, ok
from display import services
from display.models import CustomerDisplay
from outlet.models import Outlet

TOKEN_HEADER = "HTTP_X_DISPLAY_TOKEN"


class DisplaySerializer(serializers.ModelSerializer):
    paired_by_name = serializers.CharField(source="paired_by.full_name", default=None, read_only=True)

    class Meta:
        model = CustomerDisplay
        fields = ("id", "name", "paired_at", "paired_by_name", "last_seen", "created_at")


def _display_view(display: CustomerDisplay) -> dict:
    outlet = Outlet.load()
    return {
        "id": str(display.pk),
        "paired": display.is_paired,
        "code": display.code,
        "outlet": {"name": outlet.name, "address": outlet.address},
    }


class RegisterView(APIView):
    """A display opened for the first time: an id, its secret token, and the code to show."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "display_register"

    @extend_schema(request=None, responses=OpenApiTypes.OBJECT)
    def post(self, request):
        display, token = services.register()
        return ok({**_display_view(display), "token": token}, status=201)


class SelfView(APIView):
    """What the display needs to draw itself, read with its `X-Display-Token`."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses=OpenApiTypes.OBJECT)
    def get(self, request):
        display = CustomerDisplay.for_token(request.META.get(TOKEN_HEADER))
        if display is None:
            return fail(401, "This display is not registered.", code="display_unknown")
        return ok(_display_view(display))


class PairSerializer(serializers.Serializer):
    code = serializers.RegexField(r"^\s*\d{6}\s*$")


class PairView(APIView):
    permission_classes = [RequirePermission("accounts.take_payment")]

    @extend_schema(request=PairSerializer, responses=DisplaySerializer)
    def post(self, request):
        data = PairSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        display = services.pair(code=data.validated_data["code"], user=request.user)
        return ok(DisplaySerializer(display).data)


class StateSerializer(serializers.Serializer):
    state = serializers.DictField()


class StateView(APIView):
    """The cashier's screen tells its display what to show: the bill, the scanned items, paid."""

    permission_classes = [RequirePermission("accounts.take_payment")]

    @extend_schema(request=StateSerializer, responses=OpenApiTypes.OBJECT)
    def post(self, request, pk):
        display = CustomerDisplay.objects.filter(pk=pk, paired_at__isnull=False).first()
        if display is None:
            return fail(404, "This display is no longer paired.", code="display_unpaired")
        data = StateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return ok(services.push_state(display, data.validated_data["state"]))


class DisplayListView(APIView):
    permission_classes = [RequirePermission("accounts.manage_settings")]

    @extend_schema(responses=DisplaySerializer(many=True))
    def get(self, request):
        displays = CustomerDisplay.objects.filter(paired_at__isnull=False).select_related("paired_by")
        return ok(DisplaySerializer(displays, many=True).data)


class DisplayDetailView(APIView):
    permission_classes = [RequirePermission("accounts.manage_settings")]

    @extend_schema(request=None, responses=None)
    def delete(self, request, pk):
        display = CustomerDisplay.objects.filter(pk=pk).first()
        if display is None:
            return fail(404, "Not found.", code="not_found")
        services.remove(display)
        return ok()
