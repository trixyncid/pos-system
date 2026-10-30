from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from accounts.models import GroupProfile, User, pin_validator, username_validator
from accounts.permission_catalog import assignable_permissions, codename_of, permissions_by_name
from accounts.services import access
from accounts.services.tokens import revoke_sessions


class PermissionSerializer(serializers.Serializer):
    codename = serializers.SerializerMethodField()
    name = serializers.CharField()

    def get_codename(self, permission) -> str:
        return codename_of(permission)


class RoleSerializer(serializers.ModelSerializer):
    """A role is a Django Group; `code`, `description` and `is_system` live on its GroupProfile."""

    code = serializers.SlugField(source="profile.code", max_length=64)
    description = serializers.CharField(source="profile.description", allow_blank=True, required=False, default="")
    is_system = serializers.BooleanField(source="profile.is_system", read_only=True)
    # Written as "app_label.codename" strings; read back the same way in to_representation.
    permissions = serializers.ListField(child=serializers.CharField(), required=False, write_only=True)
    member_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Group
        fields = ("id", "name", "code", "description", "is_system", "permissions", "member_count")

    def to_representation(self, group):
        data = super().to_representation(group)
        data["permissions"] = sorted(
            codename_of(permission) for permission in group.permissions.all() if permission in self._catalog
        )
        return data

    @property
    def _catalog(self):
        if not hasattr(self, "_catalog_cache"):
            self._catalog_cache = set(assignable_permissions())
        return self._catalog_cache

    def validate_name(self, name):
        clash = Group.objects.filter(name__iexact=name.strip())
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("Another role already has this name.")
        return name.strip()

    def validate_permissions(self, names):
        found, unknown = permissions_by_name(names)
        if unknown:
            raise serializers.ValidationError(f"Unknown permissions: {', '.join(unknown)}.")
        return found

    def validate(self, attrs):
        actor = self.context["request"].user
        profile = attrs.get("profile", {})
        code = profile.get("code")
        if self.instance is not None:
            current = self.instance.profile
            if current.is_system and code and code != current.code:
                raise serializers.ValidationError({"code": ["A built-in role keeps its code."]})
            if access.is_owner_role(self.instance) and "permissions" in self.initial_data:
                raise serializers.ValidationError({"permissions": ["The Owner role always has every permission."]})
        clash = GroupProfile.objects.filter(code=code)
        if self.instance is not None:
            clash = clash.exclude(group=self.instance)
        if code and clash.exists():
            raise serializers.ValidationError({"code": ["Another role already uses this code."]})
        if "permissions" in attrs:
            names = {codename_of(permission) for permission in attrs["permissions"]}
            access.assert_can_grant(actor, names, "permissions")
            if self.instance is not None:
                access.assert_keeps_staff_access(actor, self.instance, names)
        return attrs

    @transaction.atomic
    def create(self, validated):
        profile = validated.pop("profile")
        permissions = validated.pop("permissions", [])
        group = Group.objects.create(name=validated["name"])
        GroupProfile.objects.create(group=group, code=profile["code"], description=profile.get("description", ""))
        group.permissions.set(permissions)
        return group

    @transaction.atomic
    def update(self, group, validated):
        profile = validated.pop("profile", {})
        if "name" in validated:
            group.name = validated["name"]
            group.save(update_fields=["name"])
        if profile:
            for field in ("code", "description"):
                if field in profile:
                    setattr(group.profile, field, profile[field])
            group.profile.save()
        if "permissions" in validated:
            group.permissions.set(validated["permissions"])
        return group


class StaffSerializer(serializers.ModelSerializer):
    roles = serializers.PrimaryKeyRelatedField(source="groups", many=True, queryset=Group.objects.all(), required=False)
    role_names = serializers.SerializerMethodField()
    has_pin = serializers.BooleanField(read_only=True)
    can_sign_in = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False, allow_blank=True, trim_whitespace=False)
    pin = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = (
            "id",
            "full_name",
            "username",
            "email",
            "is_active",
            "roles",
            "role_names",
            "has_pin",
            "can_sign_in",
            "last_login",
            "date_joined",
            "password",
            "pin",
        )
        read_only_fields = ("last_login", "date_joined")
        extra_kwargs = {
            "email": {"required": False, "allow_null": True},
            # Unique and lowercase; checked in validate_username so the message is ours.
            "username": {"required": False, "validators": []},
        }

    def get_role_names(self, user) -> list[str]:
        return [group.name for group in user.groups.all()]

    def get_can_sign_in(self, user) -> bool:
        """A password is set: this account can sign in."""
        return user.has_usable_password()

    def validate_username(self, username):
        username = username.strip().lower()
        username_validator(username)
        clash = User.objects.filter(username__iexact=username)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("Another staff member uses this username.")
        return username

    def validate_email(self, email):
        if not email:
            return None
        email = email.strip().lower()
        clash = User.objects.filter(email__iexact=email)
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("Another staff member uses this email.")
        return email

    def validate_pin(self, pin):
        if pin:
            pin_validator(pin)
        return pin

    def validate(self, attrs):
        actor = self.context["request"].user
        password = attrs.get("password")
        if self.instance is None:
            if not attrs.get("username"):
                raise serializers.ValidationError({"username": ["Choose a username to sign in with."]})
            if not password:
                raise serializers.ValidationError({"password": ["Set a password to sign in with."]})
        if password:
            validate_password(password)
        if self.instance is not None and self.instance.pk == actor.pk:
            if attrs.get("is_active") is False:
                raise serializers.ValidationError({"is_active": ["You cannot deactivate yourself."]})
            if "groups" in attrs and set(attrs["groups"]) != set(self.instance.groups.all()):
                raise serializers.ValidationError({"roles": ["Ask another manager to change your own roles."]})
        if "groups" in attrs:
            access.assert_can_assign_roles(actor, attrs["groups"])
        if self.instance is not None and not actor.is_superuser:
            # Editing someone who can do more than you would let you take over their account.
            access.assert_can_assign_roles(actor, self.instance.groups.all())
        return attrs

    @transaction.atomic
    def create(self, validated):
        groups = validated.pop("groups", [])
        pin = validated.pop("pin", "")
        password = validated.pop("password", "") or None
        email = validated.pop("email", None)
        user = User.objects.create_user(email, password=password, **validated)
        if pin:
            user.set_pin(pin)
            user.save(update_fields=["pin_hash", "pin_failed_attempts", "pin_locked_until"])
        user.groups.set(groups)
        return user

    @transaction.atomic
    def update(self, user, validated):
        groups = validated.pop("groups", None)
        pin = validated.pop("pin", "")
        password = validated.pop("password", "")
        was_active = user.is_active
        for field, value in validated.items():
            setattr(user, field, value)
        if password:
            user.set_password(password)
        if pin:
            user.set_pin(pin)
        user.save()
        if groups is not None:
            user.groups.set(groups)
        # A deactivated account or a new password signs out every tablet that account was on.
        if (was_active and not user.is_active) or password:
            revoke_sessions(user)
        return user


class SetPinSerializer(serializers.Serializer):
    pin = serializers.RegexField(r"^\d{4,6}$", error_messages={"invalid": "PIN must be 4 to 6 digits."})
