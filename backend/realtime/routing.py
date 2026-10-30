from django.urls import path

from realtime.consumers import OutletConsumer

websocket_urlpatterns = [
    path("ws/outlet/", OutletConsumer.as_asgi()),
]
