from rest_framework.routers import SimpleRouter

from orders.views import OrderViewSet

app_name = "orders"

router = SimpleRouter()
router.register("orders", OrderViewSet, basename="order")

urlpatterns = router.urls
