from django.urls import path

from display.consumers import DisplayConsumer
from realtime.consumers import OutletConsumer

websocket_urlpatterns = [
    path("ws/outlet/", OutletConsumer.as_asgi()),
    path("ws/display/", DisplayConsumer.as_asgi()),
]
