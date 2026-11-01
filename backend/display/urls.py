from django.urls import path

from display import views

app_name = "display"

urlpatterns = [
    path("displays/", views.DisplayListView.as_view(), name="list"),
    path("displays/register/", views.RegisterView.as_view(), name="register"),
    path("displays/self/", views.SelfView.as_view(), name="self"),
    path("displays/pair/", views.PairView.as_view(), name="pair"),
    path("displays/<uuid:pk>/", views.DisplayDetailView.as_view(), name="detail"),
    path("displays/<uuid:pk>/state/", views.StateView.as_view(), name="state"),
]
