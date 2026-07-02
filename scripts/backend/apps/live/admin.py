from django.contrib import admin
from .models import LiveStream, LiveChatMessage, LiveViewer


@admin.register(LiveStream)
class LiveStreamAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'status', 'viewer_count', 'created_at')
    list_filter = ('status',)


@admin.register(LiveChatMessage)
class LiveChatMessageAdmin(admin.ModelAdmin):
    list_display = ('user', 'stream', 'message', 'is_deleted', 'created_at')
