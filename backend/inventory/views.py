"""Stock on hand, the movement ledger, and receiving, waste and counts. All need accounts.manage_stock."""

from django.db.models import F, Q
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action

from audit.services import emit
from common.pagination import ApiPagination
from common.permissions import RequirePermission
from common.responses import ok
from inventory import services
from inventory.models import StockMovement
from inventory.serializers import (
    CountSerializer,
    MovementSerializer,
    ReceiveSerializer,
    StockItemSerializer,
    WasteSerializer,
    tracked,
)

ManageStock = RequirePermission("accounts.manage_stock")

LOW = Q(stock__gt=0, low_stock_threshold__isnull=False, stock__lte=F("low_stock_threshold"))


class StockViewSet(viewsets.GenericViewSet):
    """
    `GET /inventory/stock/`: tracked products. Filters: `search` (name, SKU,
    barcode), `kind` (ingredient, retail), `status` (low, out).
    """

    permission_classes = [ManageStock]
    serializer_class = StockItemSerializer
    pagination_class = ApiPagination

    def get_queryset(self):
        return tracked.select_related("category").order_by("name")

    def list(self, request):
        items = self.get_queryset()
        params = request.query_params
        if search := params.get("search", "").strip():
            items = items.filter(Q(name__icontains=search) | Q(sku__icontains=search) | Q(barcode=search))
        if kind := params.get("kind"):
            items = items.filter(kind=kind)
        if params.get("status") == "low":
            items = items.filter(LOW)
        elif params.get("status") == "out":
            items = items.filter(stock__lte=0)
        page = self.paginate_queryset(items)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        items = tracked.all()
        value = sum(int(max(stock, 0) * cost) for stock, cost in items.values_list("stock", "cost"))
        return ok(
            {
                "tracked": items.count(),
                "low": items.filter(LOW).count(),
                "out": items.filter(stock__lte=0).count(),
                "value": value,
            }
        )


class MovementViewSet(viewsets.GenericViewSet):
    """
    `GET /inventory/movements/`, newest first. Filters: `product`, `kind`.
    `POST receive/`, `waste/` and `count/` change stock.
    """

    permission_classes = [ManageStock]
    serializer_class = MovementSerializer
    pagination_class = ApiPagination

    def get_queryset(self):
        return StockMovement.objects.select_related("product", "by", "order")

    def list(self, request):
        movements = self.get_queryset()
        if product := request.query_params.get("product"):
            movements = movements.filter(product_id=product)
        if kind := request.query_params.get("kind"):
            movements = movements.filter(kind__in=kind.split(","))
        page = self.paginate_queryset(movements)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    def _many(self, movements, status=201):
        ids = [m.pk for m in movements]
        return ok(self.get_serializer(self.get_queryset().filter(pk__in=ids), many=True).data, status=status)

    @extend_schema(request=ReceiveSerializer, responses=MovementSerializer(many=True))
    @action(detail=False, methods=["post"])
    def receive(self, request):
        data = ReceiveSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        movements = services.receive(
            user=request.user,
            reference=data.validated_data["id"],
            lines=data.validated_data["lines"],
            supplier=data.validated_data["supplier"],
            note=data.validated_data["note"],
        )
        emit(
            request,
            "stock.receive",
            target_label=data.validated_data["supplier"],
            metadata={
                "items": len(movements),
                "total": sum(int(m.quantity * (m.unit_cost or 0)) for m in movements),
            },
        )
        return self._many(movements)

    @extend_schema(request=WasteSerializer, responses=MovementSerializer)
    @action(detail=False, methods=["post"])
    def waste(self, request):
        data = WasteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        movement = services.waste(user=request.user, **data.validated_data)
        emit(
            request,
            "stock.waste",
            target=movement.product,
            target_label=movement.product.name,
            metadata={"quantity": str(-movement.quantity), "reason": movement.reason},
        )
        return ok(self.get_serializer(movement).data, status=201)

    @extend_schema(request=CountSerializer, responses=MovementSerializer(many=True))
    @action(detail=False, methods=["post"])
    def count(self, request):
        data = CountSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        movements = services.count(
            user=request.user,
            reference=data.validated_data["id"],
            lines=data.validated_data["lines"],
            note=data.validated_data["note"],
        )
        emit(
            request,
            "stock.count",
            metadata={
                "counted": len(data.validated_data["lines"]),
                "adjusted": len(movements),
                "value": sum(int(m.quantity * m.product.cost) for m in movements),
            },
        )
        return self._many(movements)
