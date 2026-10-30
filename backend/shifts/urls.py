from rest_framework.routers import SimpleRouter

from shifts.views import ShiftViewSet

app_name = "shifts"

router = SimpleRouter()
router.register("shifts", ShiftViewSet, basename="shift")

urlpatterns = router.urls
