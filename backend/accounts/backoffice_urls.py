from django.urls import path
from rest_framework.routers import SimpleRouter

from accounts.staff_views import PermissionListView, RoleViewSet, StaffViewSet

app_name = "backoffice"

router = SimpleRouter()
router.register("staff", StaffViewSet, basename="staff")
router.register("roles", RoleViewSet, basename="role")

urlpatterns = [
    path("permissions/", PermissionListView.as_view(), name="permissions"),
    *router.urls,
]
