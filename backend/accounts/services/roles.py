"""Seeding and assigning roles (Django Groups with a GroupProfile)."""

from django.contrib.auth.models import Group
from django.db import transaction

from accounts.models import GroupProfile
from accounts.permission_catalog import assignable_permissions
from accounts.roles import SYSTEM_ROLES


@transaction.atomic
def ensure_system_roles() -> list[Group]:
    """
    Create the seeded roles, or bring their names and permissions back to the
    defaults. Safe to run on every deploy.
    """
    groups = []
    pos_actions = assignable_permissions().filter(content_type__model="posaccess")
    for code, (name, actions) in SYSTEM_ROLES.items():
        profile = GroupProfile.objects.filter(code=code).select_related("group").first()
        if profile is None:
            group, _ = Group.objects.get_or_create(name=name)
            GroupProfile.objects.create(group=group, code=code, is_system=True)
        else:
            group = profile.group
            if group.name != name:
                group.name = name
                group.save(update_fields=["name"])
        if actions == ("*",):
            group.permissions.set(assignable_permissions())
        else:
            group.permissions.set(pos_actions.filter(codename__in=actions))
        groups.append(group)
    return groups


def set_roles(user, groups) -> None:
    user.groups.set(groups)
