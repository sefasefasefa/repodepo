from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'display_name', 'role', 'is_verified', 'is_banned', 'created_at')
    list_filter = ('role', 'is_verified', 'is_banned', 'is_staff')
    search_fields = ('username', 'email', 'display_name')
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'updated_at', 'session_token')

    fieldsets = (
        (None, {'fields': ('username', 'email', 'password_hash')}),
        ('Profile', {'fields': ('display_name', 'bio', 'avatar_url', 'banner_url', 'social_links')}),
        ('Status', {'fields': ('role', 'is_verified', 'is_banned', 'ban_reason')}),
        ('Stats', {'fields': ('follower_count', 'following_count', 'video_count', 'total_views')}),
        ('Monetization', {'fields': ('subscription_price',)}),
        ('Permissions', {'fields': ('is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('created_at', 'updated_at')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'display_name', 'role'),
        }),
    )
