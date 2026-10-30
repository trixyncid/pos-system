from rest_framework.routers import SimpleRouter

from promos.views import PromoViewSet

app_name = "promos"

router = SimpleRouter()
router.register("promos", PromoViewSet, basename="promo")

urlpatterns = router.urls
