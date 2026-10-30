"""
Permission checks are always by Django permission codename, never by role
name: a role is just a Group, and an owner can give any action to any role.
"""

from rest_framework.permissions import BasePermission, DjangoModelPermissions


class RequirePermission(BasePermission):
    """
    `permission_classes = [RequirePermission("pos.void_sent_item")]`, or set
    `required_permission` on the view and list `RequirePermission` bare.
    """

    def __init__(self, permission: str | None = None):
        self.permission = permission

    def __call__(self):
        # DRF instantiates each entry; returning self lets the list hold a configured instance.
        return self

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        codename = self.permission or getattr(view, "required_permission", None)
        if not codename:
            return True
        return user.has_perm(codename)


class ModelPermissions(DjangoModelPermissions):
    """DRF's model permissions, but reading a list also needs `view_<model>`."""

    perms_map = {
        **DjangoModelPermissions.perms_map,
        "GET": ["%(app_label)s.view_%(model_name)s"],
        "HEAD": ["%(app_label)s.view_%(model_name)s"],
    }
