from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from accounts.models import GroupProfile, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("full_name",)
    list_display = ("email", "full_name", "is_active", "is_staff")
    search_fields = ("email", "full_name")
    readonly_fields = ("pin_failed_attempts", "pin_locked_until", "last_login", "date_joined")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name",)}),
        ("PIN", {"fields": ("pin_failed_attempts", "pin_locked_until")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "full_name", "password1", "password2")}),)


@admin.register(GroupProfile)
class GroupProfileAdmin(admin.ModelAdmin):
    list_display = ("group", "code", "is_system")
    readonly_fields = ("is_system",)
