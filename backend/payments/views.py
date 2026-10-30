"""Snack bar counter sales: one request makes the order, takes the cash and prints the receipt."""

from django.db.models import Prefetch
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, viewsets

from audit.services import emit
from common.permissions import RequirePermission
from common.responses import ok
from orders.models import Channel, Order, OrderLine, OrderStatus
from orders.serializers import LineInputSerializer, OrderSerializer
from orders.services import LineInput
from payments import services


class SaleSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    lines = LineInputSerializer(many=True, allow_empty=False, max_length=200)
    method = serializers.ChoiceField(choices=["cash"], default="cash")
    tendered = serializers.IntegerField(min_value=0, max_value=100_000_000)


class SaleViewSet(viewsets.GenericViewSet):
    """`GET /sales/` lists today's counter sales, newest first (the last 30)."""

    permission_classes = [RequirePermission("accounts.take_payment")]
    serializer_class = OrderSerializer
    pagination_class = None

    def get_queryset(self):
        return Order.objects.filter(channel=Channel.SNACKBAR).prefetch_related(
            Prefetch("lines", queryset=OrderLine.objects.select_related("added_by").order_by("created_at")),
            "payments__received_by",
        )

    def list(self, request):
        today = timezone.localdate()
        sales = (
            self.get_queryset()
            .filter(status=OrderStatus.PAID, closed_at__date=today)
            .select_related("opened_by")
            .order_by("-closed_at")[:30]
        )
        return ok(self.get_serializer(sales, many=True).data)

    @extend_schema(request=SaleSerializer, responses=OrderSerializer)
    def create(self, request):
        data = SaleSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order = services.sell(
            user=request.user,
            sale_id=data.validated_data["id"],
            lines=[
                LineInput(
                    id=line["id"],
                    product=line["product"],
                    quantity=line["quantity"],
                    modifier_ids=line["modifiers"],
                    note=line["note"],
                    seat=None,
                )
                for line in data.validated_data["lines"]
            ],
            tendered=data.validated_data["tendered"],
            method=data.validated_data["method"],
        )
        order = self.get_queryset().get(pk=order.pk)
        emit(
            request,
            "order.sale",
            target=order,
            target_label=f"#{order.number}",
            metadata={"amount": sum(payment.amount for payment in order.payments.all()), "method": "cash"},
        )
        return ok(self.get_serializer(order).data, status=201)
