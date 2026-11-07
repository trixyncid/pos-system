"""Snack bar counter sales: one request makes the order, takes the cash and prints the receipt."""

from django.db.models import Prefetch
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, viewsets

from accounts.models import User
from audit.services import emit
from common.permissions import RequirePermission
from common.responses import ok
from orders.models import Channel, Order, OrderLine, OrderStatus
from orders.serializers import LineInputSerializer, OrderSerializer
from orders.services import LineInput
from payments import services
from payments.models import PAY_METHODS, Method

TAKE_PAYMENT = "accounts.take_payment"


class SaleSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    lines = LineInputSerializer(many=True, allow_empty=False, max_length=200)
    method = serializers.ChoiceField(choices=PAY_METHODS, default=Method.CASH)
    # Cash handed over; ignored for QRIS, which is always the exact total.
    tendered = serializers.IntegerField(min_value=0, max_value=100_000_000, default=0)
    # A sale from the cashier PC's offline queue: when it happened, who made it,
    # and whether the PC already printed the receipt and tickets.
    sold_at = serializers.DateTimeField(required=False)
    cashier = serializers.IntegerField(required=False)
    printed = serializers.BooleanField(default=False)

    def validate(self, attrs):
        cashier_id = attrs.pop("cashier", None)
        attrs["cashier"] = None
        if cashier_id is not None:
            if "sold_at" not in attrs:
                raise serializers.ValidationError({"cashier": ["Only an offline sale names its cashier."]})
            cashier = User.objects.filter(pk=cashier_id, is_active=True).first()
            if cashier is None or not cashier.has_perm(TAKE_PAYMENT):
                raise serializers.ValidationError({"cashier": ["Not a cashier."]})
            attrs["cashier"] = cashier
        return attrs


class SaleViewSet(viewsets.GenericViewSet):
    """`GET /sales/` lists today's counter sales, newest first (the last 30)."""

    permission_classes = [RequirePermission(TAKE_PAYMENT)]
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
            sold_at=data.validated_data.get("sold_at"),
            printed=data.validated_data["printed"],
            cashier=data.validated_data["cashier"],
        )
        order = self.get_queryset().get(pk=order.pk)
        emit(
            request,
            "order.sale",
            target=order,
            target_label=f"#{order.number}",
            metadata={
                "amount": sum(payment.amount for payment in order.payments.all()),
                "method": data.validated_data["method"],
                **({"offline": True} if "sold_at" in data.validated_data else {}),
            },
        )
        return ok(self.get_serializer(order).data, status=201)
