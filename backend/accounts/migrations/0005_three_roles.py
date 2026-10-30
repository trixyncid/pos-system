from django.db import migrations

RETIRED = ("manager", "print-station", "inventory")
KASIR_ACTIONS = (
    "take_order",
    "void_sent_item",
    "apply_discount",
    "manage_promos",
    "approve_override",
    "reprint",
    "take_payment",
    "open_drawer",
    "open_shift",
    "close_shift",
    "edit_floor",
    "manage_stock",
    "view_dashboard",
    "view_reports",
    "view_audit",
    "print_station",
)


def three_roles(apps, schema_editor):
    """
    Owner, Kasir and Pelayan only. Kasir now does what Manager did (plus the
    print station); staff in the retired roles move to Kasir.
    """
    Group = apps.get_model("auth", "Group")
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")
    GroupProfile = apps.get_model("accounts", "GroupProfile")
    User = apps.get_model("accounts", "User")

    kasir_profile = GroupProfile.objects.filter(code="cashier").select_related("group").first()
    if kasir_profile is None:
        return  # A fresh database: seed_roles creates the three roles.
    kasir = kasir_profile.group
    content_type, _ = ContentType.objects.get_or_create(app_label="accounts", model="posaccess")
    permissions = [
        Permission.objects.get_or_create(content_type=content_type, codename=codename, defaults={"name": codename})[0]
        for codename in KASIR_ACTIONS
    ]
    kasir.permissions.add(*permissions)
    for profile in GroupProfile.objects.filter(code__in=RETIRED).select_related("group"):
        for user in User.objects.filter(groups=profile.group):
            user.groups.add(kasir)
            user.groups.remove(profile.group)
        group = profile.group
        profile.delete()
        group.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0004_user_username"),
        ("contenttypes", "0002_remove_content_type_name"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [migrations.RunPython(three_roles, migrations.RunPython.noop)]
