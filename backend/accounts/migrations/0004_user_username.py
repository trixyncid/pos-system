import django.core.validators
from django.db import migrations, models


def fill_usernames(apps, schema_editor):
    """Every account needs a username now: from the email, else from the name."""
    import re

    User = apps.get_model("accounts", "User")
    taken = set()
    for user in User.objects.order_by("pk"):
        base = ""
        for source in (user.email, user.full_name):
            if source:
                base = re.sub(r"[^a-z0-9._-]+", ".", source.split("@")[0].strip().lower()).strip("._-")
                if len(base) >= 3:
                    break
        base = (base if len(base) >= 3 else "staff")[:26]
        candidate, n = base, 1
        while candidate in taken:
            n += 1
            candidate = f"{base}{n}"
        taken.add(candidate)
        user.username = candidate
        user.save(update_fields=["username"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_manage_promos"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="username",
            field=models.CharField(max_length=30, null=True, verbose_name="username"),
        ),
        migrations.RunPython(fill_usernames, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="user",
            name="username",
            field=models.CharField(
                help_text="3–30 lowercase letters, digits, dots, dashes or underscores.",
                max_length=30,
                unique=True,
                validators=[
                    django.core.validators.RegexValidator(
                        "^[a-z0-9][a-z0-9._-]{2,29}$", "3–30 lowercase letters, digits, dots, dashes or underscores."
                    )
                ],
                verbose_name="username",
            ),
        ),
    ]
