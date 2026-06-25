from django.urls import path
from . import views
from . import extra_views as ex

urlpatterns = [
    path('live', views.list_live_streams),
    path('live/history', views.live_history),
    path('live/my', ex.my_streams),
    path('live/create', views.create_stream),
    path('live/<int:stream_id>', views.get_live_stream),
    path('live/<int:stream_id>/start', views.start_stream),
    path('live/<int:stream_id>/end', views.end_stream),
    path('live/<int:stream_id>/view', ex.record_view),
    path('live/<int:stream_id>/poll/vote', ex.poll_vote),
    path('live/<int:stream_id>/goal', ex.update_goal),
    path('live/<int:stream_id>/rotate-key', ex.rotate_stream_key),
    path('live/<int:stream_id>/chat', views.get_chat_messages),
    path('live/<int:stream_id>/chat/send', views.send_chat_message),
    path('live/<int:stream_id>/chat/stream', views.live_chat_sse),
    path('live/<int:stream_id>/chat/<int:msg_id>', ex.delete_chat_message),
    path('live/<int:stream_id>/stream', views.live_stream_sse),
]
