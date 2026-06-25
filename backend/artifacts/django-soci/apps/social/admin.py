from django.contrib import admin
from .models import Follow, Story, BadgeDefinition, UserBadge, CreatorApplication, CustomRequest


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ('follower', 'following', 'created_at')
    search_fields = ('follower__username', 'following__username')


@admin.register(Story)
class StoryAdmin(admin.ModelAdmin):
    list_display = ('creator', 'media_type', 'view_count', 'expires_at', 'created_at')


@admin.register(BadgeDefinition)
class BadgeDefinitionAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'icon', 'criteria', 'is_enabled')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(UserBadge)
class UserBadgeAdmin(admin.ModelAdmin):
    list_display = ('user', 'badge', 'awarded_by_admin', 'earned_at')


@admin.register(CreatorApplication)
class CreatorApplicationAdmin(admin.ModelAdmin):
    list_display = ('user', 'status', 'created_at')
    list_filter = ('status',)


@admin.register(CustomRequest)
class CustomRequestAdmin(admin.ModelAdmin):
    list_display = ('from_user', 'to_creator', 'title', 'token_offer', 'status')
    list_filter = ('status',)
