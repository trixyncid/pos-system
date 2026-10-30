from rest_framework import serializers

from catalog.models import Category, Product
from promos.models import Benefit, Promo, PromoKind


class PromoSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    products = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Product.objects.filter(is_active=True), required=False
    )
    categories = serializers.PrimaryKeyRelatedField(many=True, queryset=Category.objects.all(), required=False)
    weekdays = serializers.ListField(child=serializers.IntegerField(min_value=0, max_value=6), required=False)

    class Meta:
        model = Promo
        fields = (
            "id",
            "name",
            "description",
            "image_url",
            "kind",
            "benefit",
            "value",
            "max_discount",
            "min_spend",
            "products",
            "categories",
            "buy_quantity",
            "get_quantity",
            "channel",
            "starts_on",
            "ends_on",
            "weekdays",
            "starts_at",
            "ends_at",
            "is_active",
            "created_at",
        )
        read_only_fields = ("id", "image_url", "created_at")

    def get_image_url(self, promo) -> str | None:
        if not promo.image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(promo.image.url) if request else promo.image.url

    def validate(self, attrs):
        get = lambda name: attrs.get(name, getattr(self.instance, name, None))  # noqa: E731
        kind, benefit, value = get("kind"), get("benefit") or Benefit.PERCENT, get("value")
        errors: dict[str, list[str]] = {}
        if kind == PromoKind.BUNDLE:
            attrs["benefit"] = Benefit.PERCENT
            benefit = Benefit.PERCENT
            if not get("buy_quantity"):
                errors["buy_quantity"] = ["How many must they buy?"]
            if not get("get_quantity"):
                errors["get_quantity"] = ["How many do they get?"]
        if kind == PromoKind.BILL and benefit == Benefit.PRICE:
            errors["benefit"] = ["A promo price applies to items, not the whole bill."]
        if benefit == Benefit.PERCENT and value is not None and not 1 <= value <= 100:
            errors["value"] = ["A percent is 1 to 100."]
        if benefit in (Benefit.AMOUNT, Benefit.PRICE) and not value:
            errors["value"] = ["Enter an amount."]
        if kind in (PromoKind.ITEMS, PromoKind.BUNDLE):
            products = attrs.get("products", list(self.instance.products.all()) if self.instance else [])
            categories = attrs.get("categories", list(self.instance.categories.all()) if self.instance else [])
            if not products and not categories:
                errors["products"] = ["Pick the items or categories it covers."]
        starts_on, ends_on = get("starts_on"), get("ends_on")
        if starts_on and ends_on and ends_on < starts_on:
            errors["ends_on"] = ["Ends before it starts."]
        if bool(get("starts_at")) != bool(get("ends_at")):
            errors["ends_at"] = ["Set both times, or neither."]
        if errors:
            raise serializers.ValidationError(errors)
        if "weekdays" in attrs:
            attrs["weekdays"] = sorted(set(attrs["weekdays"]))
        return attrs


class ApplyPromoSerializer(serializers.Serializer):
    promo = serializers.PrimaryKeyRelatedField(queryset=Promo.objects.all(), allow_null=True)
