"""
The cash drawer. Reading the current shift needs any of the shift or
payment permissions; opening, moving cash and closing each need their own.
"""

from drf_spectacular.utils import extend_schema
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission

from audit.services import emit
from common.permissions import RequirePermission
from common.responses import ok
from shifts import services
from shifts.models import CashMovement, MovementKind, Shift


class CashMovementSerializer(serializers.ModelSerializer):
    by_name = serializers.CharField(source="by.full_name", read_only=True)

    class Meta:
        model = CashMovement
        fields = ("id", "kind", "amount", "reason", "by_name", "created_at")


class ShiftSerializer(serializers.ModelSerializer):
    opened_by_name = serializers.CharField(source="opened_by.full_name", read_only=True)
    closed_by_name = serializers.CharField(source="closed_by.full_name", read_only=True, default=None)
    movements = CashMovementSerializer(many=True, read_only=True)
    totals = serializers.SerializerMethodField()
    variance = serializers.SerializerMethodField()

    class Meta:
        model = Shift
        fields = (
            "id",
            "created_at",
            "opened_by_name",
            "opening_cash",
            "closed_at",
            "closed_by_name",
            "counted_cash",
            "expected_cash",
            "variance",
            "note",
            "totals",
            "movements",
        )

    def get_totals(self, shift) -> dict:
        return shift.totals()

    def get_variance(self, shift) -> int | None:
        if shift.counted_cash is None or shift.expected_cash is None:
            return None
        return shift.counted_cash - shift.expected_cash


class OpenSerializer(serializers.Serializer):
    opening_cash = serializers.IntegerField(min_value=0, max_value=100_000_000)


class MovementSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=MovementKind.choices)
    amount = serializers.IntegerField(min_value=1, max_value=100_000_000)
    reason = serializers.CharField(max_length=120)


class CloseSerializer(serializers.Serializer):
    counted_cash = serializers.IntegerField(min_value=0, max_value=100_000_000)
    note = serializers.CharField(max_length=200, allow_blank=True, default="")


class ShiftReader(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated) and any(
            user.has_perm(p)
            for p in ("accounts.open_shift", "accounts.close_shift", "accounts.take_payment", "accounts.open_drawer")
        )


class ShiftViewSet(viewsets.GenericViewSet):
    """`GET /shifts/` lists recent shifts (newest first); `GET /shifts/current/` the open one, or null."""

    serializer_class = ShiftSerializer
    pagination_class = None

    def get_queryset(self):
        return Shift.objects.select_related("opened_by", "closed_by").prefetch_related("movements__by")

    def get_permissions(self):
        needs = {
            "create": "accounts.open_shift",
            "close": "accounts.close_shift",
            "movements": "accounts.open_drawer",
        }.get(self.action)
        return [RequirePermission(needs)] if needs else [ShiftReader()]

    def list(self, request):
        return ok(self.get_serializer(self.get_queryset()[:20], many=True).data)

    def retrieve(self, request, pk=None):
        return ok(self.get_serializer(self.get_object()).data)

    @action(detail=False, methods=["get"])
    def current(self, request):
        shift = services.current_shift()
        return ok(self.get_serializer(shift).data if shift else None)

    @extend_schema(request=OpenSerializer, responses=ShiftSerializer)
    def create(self, request):
        data = OpenSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        shift = services.open_shift(user=request.user, opening_cash=data.validated_data["opening_cash"])
        emit(request, "shift.open", target=shift, metadata={"opening_cash": shift.opening_cash})
        return ok(self.get_serializer(shift).data, status=201)

    @extend_schema(request=MovementSerializer, responses=ShiftSerializer)
    @action(detail=True, methods=["post"])
    def movements(self, request, pk=None):
        data = MovementSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        movement = services.move_cash(user=request.user, shift_id=pk, **data.validated_data)
        emit(
            request,
            f"shift.cash_{movement.kind}",
            target=movement.shift,
            metadata={"amount": movement.amount, "reason": movement.reason},
        )
        return ok(self.get_serializer(self.get_queryset().get(pk=pk)).data)

    @extend_schema(request=CloseSerializer, responses=ShiftSerializer)
    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        data = CloseSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        shift = services.close_shift(user=request.user, shift_id=pk, **data.validated_data)
        emit(
            request,
            "shift.close",
            target=shift,
            metadata={
                "counted": shift.counted_cash,
                "expected": shift.expected_cash,
                "variance": shift.counted_cash - shift.expected_cash,
            },
        )
        return ok(self.get_serializer(self.get_queryset().get(pk=pk)).data)
