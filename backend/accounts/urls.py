from django.urls import path

from accounts import auth_views

app_name = "accounts"

urlpatterns = [
    path("login/", auth_views.LoginView.as_view(), name="login"),
    path("refresh/", auth_views.TokenRefreshView.as_view(), name="refresh"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("me/", auth_views.MeView.as_view(), name="me"),
    path("approvers/", auth_views.ApproversView.as_view(), name="approvers"),
]
