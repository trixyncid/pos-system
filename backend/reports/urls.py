from django.urls import path

from reports.views import DashboardView, ItemsReportView, SalesReportView

app_name = "reports"

urlpatterns = [
    path("reports/dashboard/", DashboardView.as_view(), name="dashboard"),
    path("reports/sales/", SalesReportView.as_view(), name="sales"),
    path("reports/items/", ItemsReportView.as_view(), name="items"),
]
