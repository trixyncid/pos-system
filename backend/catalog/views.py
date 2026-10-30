"""
The catalog API. Every signed-in tablet reads it (the order screen and snack
bar need it); changing it needs accounts.manage_settings.
"""

from django.db import transaction
from django.db.models import Count, ProtectedError, Q
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import SAFE_METHODS, BasePermission

from audit.services import emit
from catalog.models import Category, ModifierGroup, Product
from catalog.serializers import (
    CategorySerializer,
    ModifierGroupSerializer,
    ProductSerializer,
    ReorderSerializer,
)
from common.images import PRODUCT, ImageRejected, to_webp
from common.responses import ok


class ReadOrManageSettings(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return request.method in SAFE_METHODS or user.has_perm("accounts.manage_settings")


class CatalogViewSet(viewsets.ModelViewSet):
    """Small, fully cached lists: no pagination, and every response uses the `ok()` envelope."""

    permission_classes = [ReadOrManageSettings]
    pagination_class = None
    audit_name = ""

    def list(self, request, *args, **kwargs):
        return ok(self.get_serializer(self.filter_queryset(self.get_queryset()), many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return ok(self.get_serializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        emit(request, f"{self.audit_name}.create", target=instance)
        return ok(self.get_serializer(self.get_queryset().get(pk=instance.pk)).data, status=201)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        before = self.audit_snapshot(instance)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save()
        emit(
            request,
            f"{self.audit_name}.update",
            target=instance,
            metadata={"fields": sorted(request.data.keys()), "before": before, "after": self.audit_snapshot(instance)},
        )
        return ok(self.get_serializer(self.get_queryset().get(pk=instance.pk)).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            with transaction.atomic():
                instance.delete()
        except ProtectedError as exc:
            raise ValidationError({"detail": "It is still in use. Move or remove what uses it first."}) from exc
        emit(request, f"{self.audit_name}.delete", target_label=str(instance))
        return ok()

    def audit_snapshot(self, instance) -> dict:
        return {}


class CategoryViewSet(CatalogViewSet):
    serializer_class = CategorySerializer
    audit_name = "category"

    def get_queryset(self):
        # Explicit order: Django drops Meta.ordering on GROUP BY (annotated) queries.
        return Category.objects.annotate(product_count=Count("products", filter=Q(products__is_active=True))).order_by(
            "sort_order", "name"
        )

    @extend_schema(request=ReorderSerializer)
    @action(detail=False, methods=["post"])
    def reorder(self, request):
        serializer = ReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["ids"]
        with transaction.atomic():
            for index, category_id in enumerate(ids):
                Category.objects.filter(pk=category_id).update(sort_order=index)
        return ok(self.get_serializer(self.get_queryset(), many=True).data)


class ModifierGroupViewSet(CatalogViewSet):
    serializer_class = ModifierGroupSerializer
    audit_name = "modifier_group"

    def get_queryset(self):
        return (
            ModifierGroup.objects.prefetch_related("options")
            .annotate(product_count=Count("products", filter=Q(products__is_active=True), distinct=True))
            .order_by("sort_order", "name")
        )


class ProductViewSet(CatalogViewSet):
    """
    Filters: `kind`, `category`, `search` (name, SKU or barcode), `barcode`
    (exact, for the snack bar scanner), `active` (default true), `available`.
    """

    serializer_class = ProductSerializer
    audit_name = "product"

    def get_queryset(self):
        return Product.objects.select_related("category").prefetch_related("modifier_groups", "recipe__ingredient")

    def filter_queryset(self, queryset):
        params = self.request.query_params
        if kind := params.get("kind"):
            queryset = queryset.filter(kind__in=kind.split(","))
        if category := params.get("category"):
            queryset = queryset.filter(category_id=category)
        if barcode := params.get("barcode"):
            queryset = queryset.filter(barcode=barcode.strip())
        if search := params.get("search", "").strip():
            queryset = queryset.filter(Q(name__icontains=search) | Q(sku__iexact=search) | Q(barcode=search))
        active = params.get("active", "true")
        if active in {"true", "false"}:
            queryset = queryset.filter(is_active=active == "true")
        if params.get("available") in {"true", "false"}:
            queryset = queryset.filter(is_available=params["available"] == "true")
        return queryset

    def audit_snapshot(self, product) -> dict:
        # Price and availability changes are what an owner asks about later.
        return {"price": product.price, "cost": product.cost, "is_available": product.is_available}

    def destroy(self, request, *args, **kwargs):
        """Products are archived, not deleted: past orders still point at them."""
        product = self.get_object()
        product.is_active = False
        product.save(update_fields=["is_active", "updated_at"])
        emit(request, "product.archive", target=product)
        return ok()

    @action(detail=True, methods=["post", "delete"], parser_classes=[MultiPartParser])
    def image(self, request, pk=None):
        product = self.get_object()
        if request.method == "DELETE":
            product.image.delete(save=True)
            return ok(self.get_serializer(product).data)
        upload = request.FILES.get("image")
        if upload is None:
            raise ValidationError({"image": ["Choose a photo."]})
        try:
            webp = to_webp(upload, PRODUCT)
        except ImageRejected as exc:
            raise ValidationError({"image": [str(exc)]}) from exc
        if product.image:
            product.image.delete(save=False)
        product.image.save(webp.name, webp, save=True)
        emit(request, "product.image", target=product)
        return ok(self.get_serializer(product).data)
