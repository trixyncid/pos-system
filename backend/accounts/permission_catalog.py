"""
Which permissions a role may be given.

Django keeps a Permission row for every model, including internals such as
sessions and tokens. Only the POS actions and the business models listed
here appear in the role editor or can be saved on a role.
"""

from django.contrib.auth.models import Permission
from django.db.models import Q

# (app_label, model). Domain models are added here as each app gets its models.
ASSIGNABLE_PERMISSION_MODELS = frozenset(
    {
        ("accounts", "posaccess"),
        ("accounts", "user"),
    }
)


def assignable_permissions_q() -> Q:
    query = Q(pk__in=[])
    for app_label, model in ASSIGNABLE_PERMISSION_MODELS:
        query |= Q(content_type__app_label=app_label, content_type__model=model)
    return query


def assignable_permissions():
    return Permission.objects.filter(assignable_permissions_q()).select_related("content_type")


def filter_assignable(permissions):
    """Drop anything outside the catalog before it is saved on a role."""
    ids = [getattr(permission, "pk", permission) for permission in permissions]
    return assignable_permissions().filter(pk__in=ids)
