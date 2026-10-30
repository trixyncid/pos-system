from decimal import Decimal

from rest_framework import serializers

from catalog.models import Product
from inventory.models import StockMovement

QTY = {"max_digits": 12, "decimal_places": 3, "coerce_to_string": False}


def stock_status(product) -> str:
    if product.stock <= 0:
        return "out"
    if product.low_stock_threshold is not None and product.stock <= product.low_stock_threshold:
        return "low"
    return "ok"


class StockItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    image_url = serializers.SerializerMethodField()
    stock = serializers.DecimalField(**QTY)
    low_stock_threshold = serializers.DecimalField(**QTY, allow_null=True)
    status = serializers.SerializerMethodField()
    value = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "name",
            "kind",
            "unit",
            "sku",
            "barcode",
            "category_name",
            "image_url",
            "stock",
            "low_stock_threshold",
            "cost",
            "value",
            "status",
        )

    def get_image_url(self, product) -> str | None:
        if not product.image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(product.image.url) if request else product.image.url

    def get_status(self, product) -> str:
        return stock_status(product)

    def get_value(self, product) -> int:
        """What the stock on hand cost, in rupiah (negative stock counts as none)."""
        return int(max(product.stock, 0) * product.cost)


class MovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name")
    unit = serializers.CharField(source="product.unit")
    quantity = serializers.DecimalField(**QTY)
    balance = serializers.DecimalField(**QTY)
    by_name = serializers.CharField(source="by.full_name")
    order_number = serializers.IntegerField(source="order.number", default=None)

    class Meta:
        model = StockMovement
        fields = (
            "id",
            "product",
            "product_name",
            "unit",
            "kind",
            "quantity",
            "balance",
            "unit_cost",
            "reason",
            "order_number",
            "by_name",
            "created_at",
        )


tracked = Product.objects.filter(track_stock=True, is_active=True)


class ReceiveLineSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=tracked)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))
    unit_cost = serializers.IntegerField(min_value=0, max_value=100_000_000)


class ReceiveSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    supplier = serializers.CharField(max_length=60, allow_blank=True, default="")
    note = serializers.CharField(max_length=60, allow_blank=True, default="")
    lines = ReceiveLineSerializer(many=True, allow_empty=False, max_length=100)


class WasteSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=tracked)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))
    reason = serializers.CharField(max_length=120)


class CountLineSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=tracked)
    counted = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=0)


class CountSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    note = serializers.CharField(max_length=120, allow_blank=True, default="")
    lines = CountLineSerializer(many=True, allow_empty=False, max_length=500)
