from django.urls import path
from . import views
from . import extra_views as ex

urlpatterns = [
    path('notifications', views.list_notifications),
    path('notifications/unread-count', ex.unread_count),
    path('notifications/mark-all-read', views.mark_all_read),
    path('notifications/read-all', views.mark_all_read),
    path('notifications/<int:notification_id>/read', views.mark_read),
    path('notifications/stream', views.notification_stream),
]
