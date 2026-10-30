from rest_framework.routers import SimpleRouter

from payments.views import SaleViewSet

app_name = "payments"

router = SimpleRouter()
router.register("sales", SaleViewSet, basename="sale")

urlpatterns = router.urls
