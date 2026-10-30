from rest_framework import serializers

from outlet.models import Outlet


class OutletSerializer(serializers.ModelSerializer):
    # Percentages leave the API as numbers, matching the frontend's zod schema. Declaring
    # the fields replaces the model's validators, so the limits are repeated here.
    pbjt_percent = serializers.DecimalField(
        max_digits=4, decimal_places=2, min_value=0, max_value=10, coerce_to_string=False
    )
    service_percent = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=0, max_value=100, coerce_to_string=False
    )

    class Meta:
        model = Outlet
        fields = (
            "id",
            "name",
            "address",
            "npwpd",
            "pbjt_percent",
            "service_percent",
            "tax_base",
            "cash_rounding",
            "receipt_header",
            "receipt_footer",
            "idle_lock_minutes",
        )
        read_only_fields = ("id",)
