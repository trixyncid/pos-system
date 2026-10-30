"""The owner dashboard (accounts.view_dashboard) and sales reports (accounts.view_reports)."""

from datetime import date, timedelta

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from common.permissions import RequirePermission
from common.responses import ok
from reports import services


def _date(value: str | None, name: str, default: date) -> date:
    if not value:
        return default
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValidationError({name: ["Use YYYY-MM-DD."]}) from exc


def _range(request) -> tuple[date, date]:
    today = timezone.localdate()
    last = _date(request.query_params.get("to"), "to", today)
    first = _date(request.query_params.get("from"), "from", last - timedelta(days=6))
    if first > last:
        raise ValidationError({"from": ["Comes after the end date."]})
    if (last - first).days >= services.MAX_DAYS:
        raise ValidationError({"from": [f"At most {services.MAX_DAYS} days at a time."]})
    return first, last


RANGE = [OpenApiParameter("from", str), OpenApiParameter("to", str)]


class DashboardView(APIView):
    """`GET /reports/dashboard/?date=` one day's figures, against yesterday and the same day last week."""

    permission_classes = [RequirePermission("accounts.view_dashboard")]

    @extend_schema(parameters=[OpenApiParameter("date", str)], responses=dict)
    def get(self, request):
        day = _date(request.query_params.get("date"), "date", timezone.localdate())
        return ok(services.dashboard(day))


class SalesReportView(APIView):
    """`GET /reports/sales/?from=&to=` one row per day (default: the last 7 days)."""

    permission_classes = [RequirePermission("accounts.view_reports")]

    @extend_schema(parameters=RANGE, responses=dict)
    def get(self, request):
        first, last = _range(request)
        rows = services.sales_by_day(first, last)
        return ok({"from": first.isoformat(), "to": last.isoformat(), "rows": rows})


class ItemsReportView(APIView):
    """`GET /reports/items/?from=&to=` what sold, best revenue first."""

    permission_classes = [RequirePermission("accounts.view_reports")]

    @extend_schema(parameters=RANGE, responses=dict)
    def get(self, request):
        first, last = _range(request)
        return ok({"from": first.isoformat(), "to": last.isoformat(), "rows": services.items_sold(first, last)})
