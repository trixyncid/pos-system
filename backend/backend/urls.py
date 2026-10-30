from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from . import views

api_v1 = [
    path("auth/", include("accounts.urls")),
    path("", include("outlet.urls")),
    path("", include("accounts.backoffice_urls")),
    path("catalog/", include("catalog.urls")),
    path("floor/", include("floor.urls")),
    path("", include("orders.urls")),
    path("", include("shifts.urls")),
    path("printing/", include("printing.urls")),
]

urlpatterns = [
    path("health/", views.health),
    path("api/v1/", include(api_v1)),
    path("admin/", admin.site.urls),
]

# The schema lists every endpoint, so it is public only in development or when asked for.
if settings.DEBUG or settings.API_DOCS_PUBLIC:
    urlpatterns += [
        path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
    ]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
