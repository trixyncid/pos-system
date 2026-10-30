"""Promo set-up for the owner (accounts.manage_promos). Applying one is an order action."""

from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser

from audit.services import emit
from common.images import PROMO, ImageRejected, to_webp
from common.permissions import RequirePermission
from common.responses import ok
from promos.models import Promo
from promos.serializers import PromoSerializer


class PromoViewSet(viewsets.ModelViewSet):
    """Small list, no paging. DELETE switches a promo off: past bills still name it."""

    permission_classes = [RequirePermission("accounts.manage_promos")]
    serializer_class = PromoSerializer
    pagination_class = None
    queryset = Promo.objects.prefetch_related("products", "categories")

    def list(self, request):
        return ok(self.get_serializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, pk=None):
        return ok(self.get_serializer(self.get_object()).data)

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        promo = serializer.save()
        emit(request, "promo.create", target=promo, target_label=promo.name)
        return ok(self.get_serializer(promo).data, status=201)

    def update(self, request, pk=None, partial=False):
        promo = self.get_object()
        serializer = self.get_serializer(promo, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        promo = serializer.save()
        emit(request, "promo.update", target=promo, target_label=promo.name)
        return ok(self.get_serializer(promo).data)

    def partial_update(self, request, pk=None):
        return self.update(request, pk, partial=True)

    def destroy(self, request, pk=None):
        promo = self.get_object()
        promo.is_active = False
        promo.save(update_fields=["is_active", "updated_at"])
        emit(request, "promo.archive", target=promo, target_label=promo.name)
        return ok()

    @extend_schema(request=None, responses=PromoSerializer)
    @action(detail=True, methods=["post", "delete"], parser_classes=[MultiPartParser])
    def image(self, request, pk=None):
        promo = self.get_object()
        if request.method == "DELETE":
            promo.image.delete(save=True)
            return ok(self.get_serializer(promo).data)
        upload = request.FILES.get("image")
        if upload is None:
            raise ValidationError({"image": ["Choose an image."]})
        try:
            webp = to_webp(upload, PROMO)
        except ImageRejected as exc:
            raise ValidationError({"image": [str(exc)]}) from exc
        if promo.image:
            promo.image.delete(save=False)
        promo.image.save(webp.name, webp, save=True)
        return ok(self.get_serializer(promo).data)
