from rest_framework.routers import SimpleRouter

from floor.views import AreaViewSet

app_name = "floor"

router = SimpleRouter()
router.register("areas", AreaViewSet, basename="area")

urlpatterns = router.urls
