from drf_spectacular.utils import extend_schema
from rest_framework.views import APIView

from common.permissions import RequirePermission
from common.responses import ok
from outlet.models import Outlet
from outlet.serializers import OutletSerializer


class OutletView(APIView):
    """Every signed-in tablet reads the outlet (name, tax rules); changing it needs manage_settings."""

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [RequirePermission("accounts.manage_settings")]
        return super().get_permissions()

    @extend_schema(responses=OutletSerializer)
    def get(self, request):
        return ok(OutletSerializer(Outlet.load()).data)

    @extend_schema(request=OutletSerializer, responses=OutletSerializer)
    def patch(self, request):
        serializer = OutletSerializer(Outlet.load(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return ok(serializer.data)
