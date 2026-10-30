from django.db import transaction
from django.db.models import CharField, F, Value
from django.db.models.functions import Cast, Concat, Right
from rest_framework import serializers

from floor.models import Area, Table


class TableSerializer(serializers.ModelSerializer):
    """
    A table and its live state. Until orders exist (M5) a table is either
    "available" or "cleaning"; the occupancy fields stay null.
    """

    id = serializers.UUIDField(required=False)
    status = serializers.SerializerMethodField()
    seated_at = serializers.SerializerMethodField()
    guests = serializers.SerializerMethodField()
    order_total = serializers.SerializerMethodField()
    waiter = serializers.SerializerMethodField()

    class Meta:
        model = Table
        fields = (
            "id",
            "label",
            "shape",
            "x",
            "y",
            "width",
            "height",
            "rotation",
            "capacity",
            "status",
            "seated_at",
            "guests",
            "order_total",
            "waiter",
        )
        extra_kwargs = {"label": {"validators": []}}

    def get_status(self, table) -> str:
        return "cleaning" if table.needs_cleaning else "available"

    def get_seated_at(self, table) -> str | None:
        return None

    def get_guests(self, table) -> int | None:
        return None

    def get_order_total(self, table) -> int | None:
        return None

    def get_waiter(self, table) -> str | None:
        return None


class AreaSerializer(serializers.ModelSerializer):
    tables = TableSerializer(many=True, read_only=True)

    class Meta:
        model = Area
        fields = ("id", "name", "sort_order", "is_active", "tables")

    def validate_name(self, name):
        clash = Area.objects.filter(name__iexact=name.strip())
        if self.instance:
            clash = clash.exclude(pk=self.instance.pk)
        if clash.exists():
            raise serializers.ValidationError("Another area has this name.")
        return name.strip()


class LayoutSerializer(serializers.Serializer):
    """
    The whole area as the editor holds it. Saving replaces the area's tables:
    rows with a known id are updated, new rows are created, missing ones removed.
    """

    tables = TableSerializer(many=True)

    def validate_tables(self, tables):
        labels = [table["label"].strip() for table in tables]
        duplicates = sorted({label for label in labels if labels.count(label) > 1})
        if duplicates:
            raise serializers.ValidationError(f"Each table needs its own label: {', '.join(duplicates)}.")
        area = self.context["area"]
        ids = [table.get("id") for table in tables if table.get("id")]
        taken = Table.objects.filter(label__in=labels).exclude(area=area).values_list("label", flat=True)
        if taken:
            raise serializers.ValidationError(f"Already used in another area: {', '.join(sorted(taken))}.")
        foreign = Table.objects.filter(pk__in=ids).exclude(area=area)
        if foreign.exists():
            raise serializers.ValidationError("A table from another area cannot be saved here.")
        return tables

    @transaction.atomic
    def save(self):
        area = self.context["area"]
        tables = self.validated_data["tables"]
        keep = [table["id"] for table in tables if table.get("id")]
        area.tables.exclude(pk__in=keep).delete()
        # Free every label first, so two tables can swap labels in one save.
        area.tables.update(label=_temporary_labels())
        for data in tables:
            table_id = data.pop("id", None)
            data["label"] = data["label"].strip()
            existing = area.tables.filter(pk=table_id).first() if table_id else None
            if existing is None:
                Table.objects.create(area=area, **({"id": table_id} if table_id else {}), **data)
            else:
                for field, value in data.items():
                    setattr(existing, field, value)
                existing.save()
        return area


def _temporary_labels():
    """
    A unique throwaway label per row ("~" plus the id's last 11 characters,
    its random part), used while labels are being reassigned.
    """
    return Concat(Value("~"), Right(Cast(F("id"), CharField()), 11))
