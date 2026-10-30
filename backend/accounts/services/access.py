"""
Rules that keep staff and role management from becoming a way to gain power.

Anyone with accounts.manage_staff can edit staff and roles, but only up to
their own permissions: a manager cannot build or hand out a role that does
more than they can, and nobody can lock themselves out of staff management.
"""

from django.contrib.auth.models import Group
from rest_framework.exceptions import ValidationError

from accounts.permission_catalog import codename_of
from accounts.roles import OWNER

MANAGE_STAFF = "accounts.manage_staff"


def held_permissions(actor) -> set[str]:
    return set(actor.get_all_permissions())


def group_permission_names(group: Group) -> set[str]:
    return {codename_of(permission) for permission in group.permissions.select_related("content_type")}


def assert_can_grant(actor, names: set[str], field: str) -> None:
    """Reject `names` the actor does not hold themselves."""
    if actor.is_superuser:
        return
    missing = sorted(names - held_permissions(actor))
    if missing:
        raise ValidationError({field: [f"You cannot grant permissions you do not have: {', '.join(missing)}."]})


def assert_can_assign_roles(actor, groups) -> None:
    """A role may be given only by someone who holds everything that role allows."""
    if actor.is_superuser:
        return
    held = held_permissions(actor)
    for group in groups:
        missing = group_permission_names(group) - held
        if missing:
            raise ValidationError({"roles": [f"You cannot give the role {group.name}: it can do more than you."]})


def is_owner_role(group: Group) -> bool:
    return getattr(getattr(group, "profile", None), "code", "") == OWNER


def assert_keeps_staff_access(actor, group: Group, new_names: set[str]) -> None:
    """Editing your own role must not take away your own access to this screen."""
    if actor.is_superuser or MANAGE_STAFF in new_names:
        return
    if not actor.groups.filter(pk=group.pk).exists():
        return
    others = actor.groups.exclude(pk=group.pk).filter(
        permissions__content_type__app_label="accounts", permissions__codename="manage_staff"
    )
    if not others.exists():
        raise ValidationError({"permissions": ["This would remove your own access to staff and roles."]})
