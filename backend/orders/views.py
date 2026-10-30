"""Order endpoints. Everything here needs accounts.take_order; rules live in orders.services."""

from django.db.models import Prefetch
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError

from audit.services import emit
from common.permissions import RequirePermission
from common.responses import ok
from orders import services
from orders.models import SEATED, LineStatus, Order, OrderLine
from orders.serializers import (
    AddLinesSerializer,
    DiscountSerializer,
    GuestsSerializer,
    MergeSerializer,
    MoveSerializer,
    OpenOrderSerializer,
    OrderSerializer,
    PaySerializer,
    SendSerializer,
    UpdateLineSerializer,
    VoidSerializer,
)
from payments import services as checkout
from promos import services as promo_services
from promos.models import Promo
from promos.serializers import ApplyPromoSerializer, PromoSerializer

TakeOrder = RequirePermission("accounts.take_order")
TakePayment = RequirePermission("accounts.take_payment")


class OrderViewSet(viewsets.GenericViewSet):
    """
    `GET /orders/` lists orders still holding a table (open or billed);
    `?table=` narrows it to one table.
    """

    serializer_class = OrderSerializer
    pagination_class = None

    def get_permissions(self):
        if self.action in {"bill", "payments", "promos", "promo"}:
            return [TakePayment]
        return [TakeOrder]

    def get_queryset(self):
        return Order.objects.select_related("table", "opened_by").prefetch_related(
            Prefetch("lines", queryset=OrderLine.objects.select_related("added_by").order_by("created_at")),
            "payments__received_by",
            "promo__products",
            "promo__categories",
        )

    def _approver(self, data):
        if data.get("approver") is None:
            return None
        if not data.get("approver_pin"):
            raise ValidationError({"approver_pin": ["Enter the approving manager's PIN."]})
        return services.check_approver(approver_id=data["approver"], pin=data["approver_pin"])

    def _reply(self, order, status=200):
        return ok(self.get_serializer(self.get_queryset().get(pk=order.pk)).data, status=status)

    def list(self, request):
        orders = self.get_queryset().filter(status__in=SEATED)
        if table := request.query_params.get("table"):
            orders = orders.filter(table_id=table)
        return ok(self.get_serializer(orders, many=True).data)

    def retrieve(self, request, pk=None):
        return ok(self.get_serializer(self.get_object()).data)

    @extend_schema(request=OpenOrderSerializer, responses=OrderSerializer)
    def create(self, request):
        data = OpenOrderSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order = services.open_order(
            user=request.user,
            order_id=data.validated_data["id"],
            table=data.validated_data.get("table"),
            guests=data.validated_data["guests"],
            type=data.validated_data["type"],
            channel=data.validated_data["channel"],
        )
        return self._reply(order, status=201)

    @extend_schema(request=AddLinesSerializer, responses=OrderSerializer)
    @action(detail=True, methods=["post"])
    def lines(self, request, pk=None):
        data = AddLinesSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        lines = [
            services.LineInput(
                id=line["id"],
                product=line["product"],
                quantity=line["quantity"],
                modifier_ids=line["modifiers"],
                note=line["note"],
                seat=line.get("seat"),
            )
            for line in data.validated_data["lines"]
        ]
        order = services.add_lines(user=request.user, order_id=pk, lines=lines, send=data.validated_data["send"])
        return self._reply(order)

    @extend_schema(request=SendSerializer, responses=OrderSerializer)
    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        data = SendSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order = services.send_held(user=request.user, order_id=pk, line_ids=data.validated_data["line_ids"])
        return self._reply(order)

    @extend_schema(request=UpdateLineSerializer, responses=OrderSerializer)
    @action(detail=True, methods=["patch"], url_path=r"lines/(?P<line_id>[^/.]+)")
    def update_line(self, request, pk=None, line_id=None):
        data = UpdateLineSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order = services.update_held_line(order_id=pk, line_id=line_id, **data.validated_data)
        return self._reply(order)

    @extend_schema(request=VoidSerializer, responses=OrderSerializer)
    @action(detail=True, methods=["post"], url_path=r"lines/(?P<line_id>[^/.]+)/void")
    def void_line(self, request, pk=None, line_id=None):
        data = VoidSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        approver = self._approver(data.validated_data)
        order, line, authorised_by = services.void_line(
            user=request.user,
            order_id=pk,
            line_id=line_id,
            reason=data.validated_data["reason"],
            approver=approver,
        )
        if line.status == LineStatus.VOID:
            emit(
                request,
                "order.void_item",
                target=order,
                target_label=f"#{order.number} · {line.quantity}× {line.name}",
                metadata={
                    "line": str(line.pk),
                    "amount": line.total,
                    "reason": line.void_reason,
                    "approved_by": authorised_by.full_name,
                },
            )
        return self._reply(order)

    @extend_schema(request=MoveSerializer, responses=OrderSerializer)
    @action(detail=True, methods=["post"])
    def move(self, request, pk=None):
        data = MoveSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order = services.move_order(order_id=pk, table=data.validated_data["table"])
        emit(request, "order.move", target=order, metadata={"table": order.table.label})
        return self._reply(order)

    @extend_schema(request=MergeSerializer, responses=OrderSerializer)
    @action(detail=True, methods=["post"])
    def merge(self, request, pk=None):
        data = MergeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order = services.merge_orders(target_id=pk, source_id=data.validated_data["source"].pk)
        emit(request, "order.merge", target=order, metadata={"from": str(data.validated_data["source"].pk)})
        return self._reply(order)

    @extend_schema(request=GuestsSerializer, responses=OrderSerializer)
    @action(detail=True, methods=["post"])
    def guests(self, request, pk=None):
        data = GuestsSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return self._reply(services.set_guests(order_id=pk, guests=data.validated_data["guests"]))

    @extend_schema(request=None, responses=OrderSerializer)
    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        order = services.cancel_order(order_id=pk)
        emit(request, "order.cancel", target=order)
        return self._reply(order)

    @extend_schema(request=DiscountSerializer, responses=OrderSerializer)
    @action(detail=True, methods=["post"])
    def discount(self, request, pk=None):
        data = DiscountSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order, authorised_by = checkout.set_discount(
            user=request.user,
            order_id=pk,
            kind=data.validated_data["kind"],
            value=data.validated_data["value"],
            reason=data.validated_data["reason"],
            approver=self._approver(data.validated_data),
        )
        emit(
            request,
            "order.discount",
            target=order,
            target_label=f"#{order.number}",
            metadata={
                "kind": order.discount_kind,
                "value": order.discount_value,
                "reason": order.discount_reason,
                "approved_by": authorised_by.full_name,
            },
        )
        return self._reply(order)

    @extend_schema(request=None, responses=OrderSerializer)
    @action(detail=True, methods=["post"])
    def bill(self, request, pk=None):
        return self._reply(checkout.print_bill(user=request.user, order_id=pk))

    @extend_schema(request=PaySerializer, responses=OrderSerializer)
    @action(detail=True, methods=["post"])
    def payments(self, request, pk=None):
        data = PaySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        order, payment = checkout.pay(
            user=request.user,
            order_id=pk,
            payment_id=data.validated_data["id"],
            method=data.validated_data["method"],
            tendered=data.validated_data["tendered"],
            amount=data.validated_data.get("amount"),
            line_ids=data.validated_data.get("line_ids"),
        )
        emit(request, "order.payment", target=order, metadata={"amount": payment.amount, "method": payment.method})
        return self._reply(order, status=201)

    @extend_schema(request=None, responses=dict)
    @action(detail=True, methods=["get"])
    def promos(self, request, pk=None):
        """The promos the cashier can offer on this bill now, each with what it would take off."""
        order = self.get_object()
        lines = promo_services.live_lines(order)
        rows = []
        for promo in Promo.objects.filter(is_active=True).prefetch_related("products", "categories"):
            reason = promo_services.unavailable_reason(promo, channel=order.channel)
            if reason in {"inactive", "channel", "not_started", "ended"}:
                continue  # Not a promo for today at all: keep the list short.
            saving = promo_services.discount(promo, lines) if reason is None else 0
            if reason is None and saving <= 0:
                reason = "min_spend" if sum(line.total for line in lines) < promo.min_spend else "no_items"
            rows.append(
                {
                    **PromoSerializer(promo, context={"request": request}).data,
                    "saving": saving,
                    "unavailable": reason,
                    "applied": order.promo_id == promo.pk,
                }
            )
        rows.sort(key=lambda row: (row["unavailable"] is not None, -row["saving"]))
        return ok(rows)

    @extend_schema(request=ApplyPromoSerializer, responses=OrderSerializer)
    @action(detail=True, methods=["post"])
    def promo(self, request, pk=None):
        data = ApplyPromoSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        promo = data.validated_data["promo"]
        order = promo_services.apply(order_id=pk, promo=promo)
        emit(
            request,
            "order.promo",
            target=order,
            target_label=f"#{order.number}",
            metadata={"promo": promo.name if promo else None},
        )
        return self._reply(order)
