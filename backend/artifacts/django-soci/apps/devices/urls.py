from django.urls import path
from . import views

urlpatterns = [
    path('devices/identify', views.identify),
    path('devices/event', views.record_event),
    path('devices/recommendations', views.recommendations),
    path('admin/devices', views.admin_devices),
]
