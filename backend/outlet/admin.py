from django.contrib import admin

from outlet.models import Outlet


@admin.register(Outlet)
class OutletAdmin(admin.ModelAdmin):
    list_display = ("name", "pbjt_percent", "service_percent", "cash_rounding")
