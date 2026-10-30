"""The audit log, read-only (accounts.view_audit). Rows are append-only."""

from datetime import date

from django.db.models import Q
from rest_framework import serializers, viewsets
from rest_framework.exceptions import ValidationError

from audit.models import AuditEvent
from common.pagination import ApiPagination
from common.permissions import RequirePermission
from reports.services import day_bounds


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = (
            "id",
            "created_at",
            "actor",
            "actor_name",
            "action",
            "target_type",
            "target_id",
            "target_label",
            "ip_address",
            "metadata",
        )


class AuditEventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Newest first. Filters: `action` (a prefix: `order.` or `order.void_item`),
    `actor` (user id), `search` (actor, target or action), `date` (one day).
    """

    permission_classes = [RequirePermission("accounts.view_audit")]
    serializer_class = AuditEventSerializer
    pagination_class = ApiPagination
    queryset = AuditEvent.objects.all()

    def filter_queryset(self, queryset):
        params = self.request.query_params
        if action := params.get("action"):
            queryset = queryset.filter(action__startswith=action)
        if actor := params.get("actor"):
            queryset = queryset.filter(actor_id=actor)
        if search := params.get("search", "").strip():
            queryset = queryset.filter(
                Q(actor_name__icontains=search) | Q(target_label__icontains=search) | Q(action__icontains=search)
            )
        if day := params.get("date"):
            try:
                start, end = day_bounds(date.fromisoformat(day))
            except ValueError as exc:
                raise ValidationError({"date": ["Use YYYY-MM-DD."]}) from exc
            queryset = queryset.filter(created_at__gte=start, created_at__lt=end)
        return queryset
