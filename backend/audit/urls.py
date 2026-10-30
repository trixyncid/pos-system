from rest_framework.routers import SimpleRouter

from audit.views import AuditEventViewSet

app_name = "audit"

router = SimpleRouter()
router.register("audit/events", AuditEventViewSet, basename="audit-event")

urlpatterns = router.urls
