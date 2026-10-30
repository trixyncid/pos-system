"""
Areas and tables. Every signed-in tablet reads the floor; changing the layout
needs accounts.edit_floor; marking a table clean needs accounts.take_order.
"""

from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import SAFE_METHODS, BasePermission

from audit.services import emit
from common.permissions import RequirePermission
from common.responses import ok
from floor.models import Area, Table
from floor.serializers import AreaSerializer, LayoutSerializer, TableSerializer
from realtime.broadcast import publish


class ReadOrEditFloor(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return request.method in SAFE_METHODS or user.has_perm("accounts.edit_floor")


def floor_changed() -> None:
    """Tell every tablet watching the floor to refetch it."""
    publish("floor", {"type": "floor.changed"})


class AreaViewSet(viewsets.ModelViewSet):
    permission_classes = [ReadOrEditFloor]
    serializer_class = AreaSerializer
    pagination_class = None

    def get_queryset(self):
        areas = Area.objects.prefetch_related("tables")
        if self.request.method in SAFE_METHODS and self.request.query_params.get("all") != "true":
            areas = areas.filter(is_active=True)
        return areas

    def list(self, request, *args, **kwargs):
        return ok(self.get_serializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return ok(self.get_serializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        area = serializer.save()
        emit(request, "area.create", target=area)
        floor_changed()
        return ok(self.get_serializer(area).data, status=201)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        area = serializer.save()
        emit(request, "area.update", target=area)
        floor_changed()
        return ok(self.get_serializer(area).data)

    def destroy(self, request, *args, **kwargs):
        area = self.get_object()
        emit(request, "area.delete", target_label=area.name, metadata={"tables": area.tables.count()})
        area.delete()
        floor_changed()
        return ok()

    @extend_schema(request=LayoutSerializer, responses=AreaSerializer)
    @action(detail=True, methods=["put"])
    def layout(self, request, pk=None):
        area = self.get_object()
        serializer = LayoutSerializer(data=request.data, context={"area": area})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        emit(request, "area.layout", target=area, metadata={"tables": len(serializer.validated_data["tables"])})
        floor_changed()
        area = self.get_queryset().get(pk=area.pk)
        return ok(self.get_serializer(area).data)


class TableViewSet(viewsets.GenericViewSet):
    queryset = Table.objects.select_related("area")
    serializer_class = TableSerializer

    @extend_schema(request=None, responses=TableSerializer)
    @action(
        detail=True,
        methods=["post"],
        permission_classes=[RequirePermission("accounts.take_order")],
    )
    def clean(self, request, pk=None):
        table = get_object_or_404(self.get_queryset(), pk=pk)
        table.needs_cleaning = False
        table.save(update_fields=["needs_cleaning", "updated_at"])
        floor_changed()
        return ok(self.get_serializer(table).data)
