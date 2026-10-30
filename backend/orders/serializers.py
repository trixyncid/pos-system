from rest_framework import serializers

from catalog.models import Product
from floor.models import Table
from orders.models import Channel, Order, OrderLine, OrderType


class OrderLineSerializer(serializers.ModelSerializer):
    total = serializers.IntegerField(read_only=True)
    added_by_name = serializers.CharField(source="added_by.full_name", read_only=True)

    class Meta:
        model = OrderLine
        fields = (
            "id",
            "product",
            "name",
            "unit_price",
            "quantity",
            "modifiers",
            "note",
            "seat",
            "station",
            "status",
            "total",
            "added_by_name",
            "sent_at",
            "void_reason",
        )


class OrderSerializer(serializers.ModelSerializer):
    lines = OrderLineSerializer(many=True, read_only=True)
    waiter = serializers.CharField(source="opened_by.full_name", read_only=True)
    subtotal = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = (
            "id",
            "number",
            "channel",
            "type",
            "table",
            "table_label",
            "guests",
            "status",
            "waiter",
            "note",
            "subtotal",
            "version",
            "created_at",
            "lines",
        )

    def get_subtotal(self, order) -> int:
        return sum(line.total for line in order.lines.all() if line.status != "void")


class OpenOrderSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    table = serializers.PrimaryKeyRelatedField(queryset=Table.objects.all(), allow_null=True, required=False)
    guests = serializers.IntegerField(min_value=1, max_value=50, default=1)
    type = serializers.ChoiceField(choices=OrderType.choices, default=OrderType.DINE_IN)
    channel = serializers.ChoiceField(choices=Channel.choices, default=Channel.RESTAURANT)

    def validate(self, attrs):
        if attrs["type"] == OrderType.DINE_IN and attrs.get("table") is None and attrs["channel"] == Channel.RESTAURANT:
            raise serializers.ValidationError({"table": ["Pick a table for a dine-in order."]})
        return attrs


class LineInputSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.select_related("category").prefetch_related("modifier_groups__options")
    )
    quantity = serializers.IntegerField(min_value=1, max_value=99, default=1)
    modifiers = serializers.ListField(child=serializers.UUIDField(), default=list)
    note = serializers.CharField(max_length=200, allow_blank=True, default="")
    seat = serializers.IntegerField(min_value=1, allow_null=True, required=False, default=None)


class AddLinesSerializer(serializers.Serializer):
    lines = LineInputSerializer(many=True, allow_empty=False)
    send = serializers.BooleanField(default=True)


class SendSerializer(serializers.Serializer):
    line_ids = serializers.ListField(child=serializers.UUIDField(), required=False, allow_null=True, default=None)


class UpdateLineSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1, max_value=99, required=False)
    note = serializers.CharField(max_length=200, allow_blank=True, required=False)
    seat = serializers.IntegerField(min_value=0, required=False, help_text="0 clears the seat.")


class VoidSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=120, allow_blank=True, default="")
    approver = serializers.IntegerField(required=False)
    approver_pin = serializers.RegexField(r"^\d{4,6}$", required=False)


class MoveSerializer(serializers.Serializer):
    table = serializers.PrimaryKeyRelatedField(queryset=Table.objects.all())


class MergeSerializer(serializers.Serializer):
    source = serializers.PrimaryKeyRelatedField(queryset=Order.objects.all())


class GuestsSerializer(serializers.Serializer):
    guests = serializers.IntegerField(min_value=1, max_value=50)
