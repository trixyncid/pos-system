from rest_framework.routers import SimpleRouter

from floor.views import AreaViewSet, TableViewSet

app_name = "floor"

router = SimpleRouter()
router.register("areas", AreaViewSet, basename="area")
router.register("tables", TableViewSet, basename="table")

urlpatterns = router.urls
