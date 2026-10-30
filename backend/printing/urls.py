from rest_framework.routers import SimpleRouter

from printing.views import PrintJobViewSet

app_name = "printing"

router = SimpleRouter()
router.register("jobs", PrintJobViewSet, basename="print-job")

urlpatterns = router.urls
