from django.urls import path

from outlet.views import OutletView

app_name = "outlet"

urlpatterns = [
    path("outlet/", OutletView.as_view(), name="outlet"),
]
