from django.contrib import admin
from .models import (
    Video, Category, VideoLike, VideoBookmark, WatchHistory,
    VideoReport, Comment, Playlist, Ad, CustomPage,
    WatermarkSettings, AutoCategoryRule, VideoPlayer, VideoSubtitle
)


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = ('title', 'creator', 'type', 'view_count', 'like_count', 'is_published', 'is_premium', 'created_at')
    list_filter = ('type', 'is_published', 'is_premium', 'category')
    search_fields = ('title', 'description', 'creator__username')
    ordering = ('-created_at',)
    readonly_fields = ('view_count', 'like_count', 'comment_count', 'created_at', 'updated_at')


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'video_count')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('author', 'video', 'content', 'like_count', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('content', 'author__username')


@admin.register(VideoReport)
class VideoReportAdmin(admin.ModelAdmin):
    list_display = ('reporter', 'content_type', 'reason', 'status', 'created_at')
    list_filter = ('status', 'content_type')


@admin.register(Ad)
class AdAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'position', 'is_active', 'impressions', 'clicks')
    list_filter = ('type', 'is_active', 'position')


@admin.register(WatermarkSettings)
class WatermarkAdmin(admin.ModelAdmin):
    list_display = ('text', 'is_enabled', 'position', 'opacity')


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    list_display = ('title', 'owner', 'video_count', 'is_public')


@admin.register(AutoCategoryRule)
class AutoCategoryRuleAdmin(admin.ModelAdmin):
    list_display = ('keyword', 'category', 'is_active')


admin.site.register(CustomPage)
admin.site.register(VideoSubtitle)
admin.site.register(VideoPlayer)
