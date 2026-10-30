from rest_framework.routers import SimpleRouter

from inventory.views import MovementViewSet, StockViewSet

app_name = "inventory"

router = SimpleRouter()
router.register("inventory/stock", StockViewSet, basename="stock")
router.register("inventory/movements", MovementViewSet, basename="movement")

urlpatterns = router.urls
