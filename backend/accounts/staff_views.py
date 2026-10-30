"""Back office: staff accounts, roles and the permission catalog. All need accounts.manage_staff."""

from django.contrib.auth.models import Group
from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from accounts.models import User
from accounts.permission_catalog import assignable_permissions
from accounts.services.access import assert_can_assign_roles
from accounts.staff_serializers import PermissionSerializer, RoleSerializer, SetPinSerializer, StaffSerializer
from audit.services import emit
from common.permissions import RequirePermission
from common.responses import ok

ManageStaff = RequirePermission("accounts.manage_staff")


class PermissionListView(APIView):
    permission_classes = [ManageStaff]

    @extend_schema(responses=PermissionSerializer(many=True))
    def get(self, request):
        permissions = assignable_permissions().order_by("id")
        return ok(PermissionSerializer(permissions, many=True).data)


class RoleViewSet(viewsets.ModelViewSet):
    permission_classes = [ManageStaff]
    serializer_class = RoleSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            Group.objects.filter(profile__isnull=False)
            .select_related("profile")
            .prefetch_related("permissions__content_type")
            .annotate(member_count=Count("user", filter=Q(user__is_active=True)))
            .order_by("-profile__is_system", "name")
        )

    def list(self, request, *args, **kwargs):
        return ok(self.get_serializer(self.get_queryset(), many=True).data)

    def retrieve(self, request, *args, **kwargs):
        return ok(self.get_serializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        group = serializer.save()
        emit(request, "role.create", target=group, metadata={"permissions": request.data.get("permissions", [])})
        return ok(self.get_serializer(self.get_queryset().get(pk=group.pk)).data, status=201)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        group = serializer.save()
        emit(request, "role.update", target=group, metadata={"changes": request.data})
        return ok(self.get_serializer(self.get_queryset().get(pk=group.pk)).data)

    def destroy(self, request, *args, **kwargs):
        group = self.get_object()
        if group.profile.is_system:
            raise ValidationError({"detail": "Built-in roles cannot be deleted."})
        if group.member_count:
            raise ValidationError({"detail": "Move its staff to another role first."})
        emit(request, "role.delete", target=group)
        group.delete()
        return ok()


class StaffViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """No delete: a staff member who leaves is deactivated, so their orders and audit history keep a name."""

    permission_classes = [ManageStaff]
    serializer_class = StaffSerializer

    def get_queryset(self):
        users = User.objects.prefetch_related("groups").order_by("-is_active", "full_name")
        search = self.request.query_params.get("search", "").strip()
        if search:
            users = users.filter(Q(full_name__icontains=search) | Q(email__icontains=search))
        active = self.request.query_params.get("active")
        if active in {"true", "false"}:
            users = users.filter(is_active=active == "true")
        return users

    def retrieve(self, request, *args, **kwargs):
        return ok(self.get_serializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        emit(request, "staff.create", target=user, metadata={"roles": request.data.get("roles", [])})
        return ok(self.get_serializer(user).data, status=201)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        changed = sorted(key for key in request.data if key not in {"password", "pin"})
        emit(request, "staff.update", target=user, metadata={"fields": changed})
        return ok(self.get_serializer(user).data)

    @extend_schema(request=SetPinSerializer, responses=StaffSerializer)
    @action(detail=True, methods=["post"], url_path="set-pin")
    def set_pin(self, request, pk=None):
        user = self.get_object()
        assert_can_assign_roles(request.user, user.groups.all())
        serializer = SetPinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_pin(serializer.validated_data["pin"])
        user.save(update_fields=["pin_hash", "pin_failed_attempts", "pin_locked_until"])
        emit(request, "staff.set_pin", target=user)
        return ok(self.get_serializer(user).data)
