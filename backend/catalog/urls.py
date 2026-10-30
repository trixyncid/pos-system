from rest_framework.routers import SimpleRouter

from catalog.views import CategoryViewSet, ModifierGroupViewSet, ProductViewSet

app_name = "catalog"

router = SimpleRouter()
router.register("categories", CategoryViewSet, basename="category")
router.register("products", ProductViewSet, basename="product")
router.register("modifier-groups", ModifierGroupViewSet, basename="modifier-group")

urlpatterns = router.urls
