"""
The print station's side of printing: fetch queued jobs, report each one
printed or failed, reprint, and send a test page.
"""

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, viewsets
from rest_framework.decorators import action

from audit.services import emit
from common.permissions import RequirePermission
from common.responses import ok
from printing.models import JobKind, JobStatus, PrintJob
from realtime.broadcast import publish

Station = RequirePermission("accounts.print_station")
Reprint = RequirePermission("accounts.reprint")


class PrintJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrintJob
        fields = ("id", "station", "kind", "status", "payload", "attempts", "error", "created_at", "printed_at")


class AckSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[JobStatus.PRINTED, JobStatus.FAILED])
    error = serializers.CharField(max_length=200, allow_blank=True, default="")


class TestSerializer(serializers.Serializer):
    station = serializers.ChoiceField(choices=["kitchen", "bar", "cashier"])


class PrintJobViewSet(viewsets.GenericViewSet):
    """`GET /printing/jobs/?status=queued&station=kitchen`, oldest first, at most 100."""

    serializer_class = PrintJobSerializer
    pagination_class = None
    queryset = PrintJob.objects.all()

    def get_permissions(self):
        if self.action == "reprint":
            return [Reprint]
        return [Station]

    def list(self, request):
        jobs = self.get_queryset()
        if status := request.query_params.get("status"):
            jobs = jobs.filter(status__in=status.split(","))
        if station := request.query_params.get("station"):
            jobs = jobs.filter(station__in=station.split(","))
        recent = jobs.order_by("-created_at")[:100]
        return ok(self.get_serializer(sorted(recent, key=lambda job: job.created_at), many=True).data)

    @extend_schema(request=AckSerializer, responses=PrintJobSerializer)
    @action(detail=True, methods=["post"])
    def ack(self, request, pk=None):
        job = self.get_object()
        data = AckSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        job.attempts += 1
        job.status = data.validated_data["status"]
        job.error = data.validated_data["error"]
        if job.status == JobStatus.PRINTED:
            job.printed_at = timezone.now()
        job.save()
        publish("print", {"type": "print.ack", "id": str(job.pk), "status": job.status})
        return ok(self.get_serializer(job).data)

    @extend_schema(request=None, responses=PrintJobSerializer)
    @action(detail=True, methods=["post"])
    def reprint(self, request, pk=None):
        original = self.get_object()
        job = PrintJob.objects.create(
            station=original.station,
            kind=original.kind,
            order=original.order,
            created_by=request.user,
            reprint_of=original,
            payload={**original.payload, "reprint": True},
        )
        emit(request, "print.reprint", target=job, metadata={"of": str(original.pk), "kind": original.kind})
        publish("print", {"type": "print.job", "id": str(job.pk), "station": job.station})
        return ok(self.get_serializer(job).data, status=201)

    @extend_schema(request=TestSerializer, responses=PrintJobSerializer)
    @action(detail=False, methods=["post"])
    def test(self, request):
        data = TestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        job = PrintJob.objects.create(
            station=data.validated_data["station"],
            kind=JobKind.TEST,
            created_by=request.user,
            payload={
                "kind": JobKind.TEST,
                "station": data.validated_data["station"],
                "by": request.user.full_name,
                "at": timezone.localtime().isoformat(),
                "lines": [],
            },
        )
        publish("print", {"type": "print.job", "id": str(job.pk), "station": job.station})
        return ok(self.get_serializer(job).data, status=201)
