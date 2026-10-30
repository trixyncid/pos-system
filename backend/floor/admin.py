from django.contrib import admin

from floor.models import Area, Table


class TableInline(admin.TabularInline):
    model = Table
    extra = 0
    fields = ("label", "shape", "capacity", "x", "y", "width", "height", "rotation")


@admin.register(Area)
class AreaAdmin(admin.ModelAdmin):
    list_display = ("name", "sort_order", "is_active")
    inlines = [TableInline]
