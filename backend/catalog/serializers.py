from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from catalog.models import (
    Category,
    Modifier,
    ModifierGroup,
    Product,
    ProductKind,
    RecipeLine,
    TaxCategory,
)


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Category
        fields = ("id", "name", "station", "sort_order", "is_active", "product_count")

    def validate_name(self, name):
        clash = Category.objects.filter(name__iexact=name.strip())
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("Another category has this name.")
        return name.strip()


class ModifierSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)

    class Meta:
        model = Modifier
        fields = ("id", "name", "price_delta", "sort_order")


class ModifierGroupSerializer(serializers.ModelSerializer):
    options = ModifierSerializer(many=True)
    product_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ModifierGroup
        fields = ("id", "name", "min_select", "max_select", "sort_order", "options", "product_count")

    def validate(self, attrs):
        minimum = attrs.get("min_select", getattr(self.instance, "min_select", 0))
        maximum = attrs.get("max_select", getattr(self.instance, "max_select", 1))
        options = attrs.get("options")
        if minimum > maximum:
            raise serializers.ValidationError({"min_select": ["The minimum cannot be above the maximum."]})
        if options is not None:
            if not options:
                raise serializers.ValidationError({"options": ["Add at least one option."]})
            if minimum > len(options):
                raise serializers.ValidationError({"min_select": ["There are fewer options than the minimum."]})
        return attrs

    def _save_options(self, group, options):
        """The options list replaces the group's options; ids keep existing rows (and their history)."""
        keep = []
        for index, option in enumerate(options):
            option_id = option.pop("id", None)
            option.setdefault("sort_order", index)
            row = group.options.filter(pk=option_id).first() if option_id else None
            if row is None:
                row = Modifier.objects.create(group=group, **option)
            else:
                for field, value in option.items():
                    setattr(row, field, value)
                row.save()
            keep.append(row.pk)
        group.options.exclude(pk__in=keep).delete()

    @transaction.atomic
    def create(self, validated):
        options = validated.pop("options")
        group = ModifierGroup.objects.create(**validated)
        self._save_options(group, options)
        return group

    @transaction.atomic
    def update(self, group, validated):
        options = validated.pop("options", None)
        for field, value in validated.items():
            setattr(group, field, value)
        group.save()
        if options is not None:
            self._save_options(group, options)
        return group


class RecipeLineSerializer(serializers.Serializer):
    ingredient = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.filter(kind=ProductKind.INGREDIENT, is_active=True)
    )
    quantity = serializers.DecimalField(
        max_digits=12, decimal_places=3, min_value=Decimal("0.001"), coerce_to_string=False
    )

    def to_representation(self, line):
        return {
            "ingredient": str(line.ingredient_id),
            "ingredient_name": line.ingredient.name,
            "unit": line.ingredient.unit,
            "quantity": float(line.quantity),
            "cost": round(line.ingredient.cost * line.quantity),
        }


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True, default=None)
    image_url = serializers.SerializerMethodField()
    recipe = RecipeLineSerializer(many=True, required=False)
    recipe_cost = serializers.SerializerMethodField()
    low_stock_threshold = serializers.DecimalField(
        max_digits=12, decimal_places=3, allow_null=True, required=False, coerce_to_string=False
    )

    class Meta:
        model = Product
        fields = (
            "id",
            "kind",
            "name",
            "description",
            "category",
            "category_name",
            "price",
            "cost",
            "unit",
            "barcode",
            "sku",
            "tax_category",
            "track_stock",
            "low_stock_threshold",
            "image_url",
            "is_available",
            "is_favorite",
            "is_active",
            "sort_order",
            "modifier_groups",
            "recipe",
            "recipe_cost",
        )
        extra_kwargs = {"barcode": {"validators": []}}

    def get_image_url(self, product) -> str | None:
        if not product.image:
            return None
        request = self.context.get("request")
        url = product.image.url
        return request.build_absolute_uri(url) if request else url

    def get_recipe_cost(self, product) -> int | None:
        lines = list(product.recipe.all())
        if not lines:
            return None
        return round(sum(line.ingredient.cost * line.quantity for line in lines))

    def validate_barcode(self, barcode):
        barcode = (barcode or "").strip() or None
        if barcode:
            clash = Product.objects.filter(barcode=barcode)
            if self.instance:
                clash = clash.exclude(pk=self.instance.pk)
            if clash.exists():
                raise serializers.ValidationError(f"{clash.first().name} already uses this barcode.")
        return barcode

    def validate(self, attrs):
        kind = attrs.get("kind", getattr(self.instance, "kind", None))
        category = attrs.get("category", getattr(self.instance, "category", None))
        errors: dict[str, list[str]] = {}
        if kind in {ProductKind.MENU, ProductKind.RETAIL} and category is None:
            errors["category"] = ["Pick a category."]
        if kind == ProductKind.INGREDIENT:
            # An ingredient is never sold on its own.
            attrs.update(category=None, price=0, tax_category=TaxCategory.NONE)
            attrs.pop("modifier_groups", None)
            if attrs.get("recipe"):
                errors["recipe"] = ["Ingredients have no recipe."]
        for line in attrs.get("recipe", []):
            if self.instance and line["ingredient"].pk == self.instance.pk:
                errors["recipe"] = ["A product cannot be its own ingredient."]
        ingredients = [line["ingredient"].pk for line in attrs.get("recipe", [])]
        if len(ingredients) != len(set(ingredients)):
            errors["recipe"] = ["Each ingredient appears once."]
        if errors:
            raise serializers.ValidationError(errors)
        return attrs

    @transaction.atomic
    def create(self, validated):
        recipe = validated.pop("recipe", [])
        groups = validated.pop("modifier_groups", [])
        product = Product.objects.create(**validated)
        product.modifier_groups.set(groups)
        self._save_recipe(product, recipe)
        return product

    @transaction.atomic
    def update(self, product, validated):
        recipe = validated.pop("recipe", None)
        groups = validated.pop("modifier_groups", None)
        for field, value in validated.items():
            setattr(product, field, value)
        product.save()
        if groups is not None:
            product.modifier_groups.set(groups)
        if recipe is not None:
            self._save_recipe(product, recipe)
        return product

    def _save_recipe(self, product, recipe):
        product.recipe.all().delete()
        RecipeLine.objects.bulk_create(
            [RecipeLine(product=product, ingredient=line["ingredient"], quantity=line["quantity"]) for line in recipe]
        )


class ReorderSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.UUIDField(), allow_empty=False)
