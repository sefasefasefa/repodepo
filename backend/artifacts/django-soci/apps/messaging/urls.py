from django.urls import path
from . import views
from . import calls_views
from . import extra_views as ex

urlpatterns = [
    path('messages/unread-count', ex.unread_count),
    path('conversations', views.list_conversations),
    path('conversations/new', views.send_message_to_user),
    path('conversations/with/<int:user_id>', views.get_conversation),
    path('conversations/<int:conversation_id>/messages', views.get_messages),
    path('conversations/<int:conversation_id>/send', views.send_message),
    path('messages/<int:message_id>', views.delete_message),
    # WebRTC calls
    path('calls/start', calls_views.call_start),
    path('calls/incoming', calls_views.call_incoming),
    path('calls/<int:call_id>', calls_views.call_get),
    path('calls/<int:call_id>/answer', calls_views.call_answer),
    path('calls/<int:call_id>/ice', calls_views.call_ice),
    path('calls/<int:call_id>/end', calls_views.call_end),
]
