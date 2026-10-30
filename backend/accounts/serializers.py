from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)


class PinUnlockSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    pin = serializers.RegexField(r"^\d{4,6}$", error_messages={"invalid": "PIN must be 4 to 6 digits."})


class RefreshSerializer(serializers.Serializer):
    """The web app sends nothing (the cookie carries the token); a native client sends it here."""

    refresh = serializers.CharField(required=False)


def user_payload(user) -> dict:
    """The signed-in user as the frontend sees it, including every permission it gates on."""
    groups = list(user.groups.select_related("profile").all())
    return {
        "id": user.pk,
        "email": user.email,
        "full_name": user.full_name,
        "has_pin": user.has_pin,
        "is_superuser": user.is_superuser,
        "roles": [
            {"id": group.pk, "code": getattr(getattr(group, "profile", None), "code", ""), "name": group.name}
            for group in groups
        ],
        # "app_label.codename" strings; an owner account with is_superuser gets every one.
        "permissions": ["*"] if user.is_superuser else sorted(user.get_all_permissions()),
    }
