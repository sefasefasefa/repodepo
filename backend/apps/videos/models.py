from django.db import models
from django.conf import settings


class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    icon_url = models.TextField(null=True, blank=True)
    video_count = models.IntegerField(default=0)

    class Meta:
        db_table = 'categories'
        verbose_name_plural = 'categories'

    def __str__(self):
        return self.name


class Video(models.Model):
    VIDEO_TYPES = [
        ('video', 'Video'),
        ('short', 'Short'),
        ('live_replay', 'Live Replay'),
    ]

    title = models.CharField(max_length=500)
    description = models.TextField(null=True, blank=True)
    thumbnail_url = models.TextField(null=True, blank=True)
    video_url = models.TextField(null=True, blank=True)
    hls_url = models.TextField(null=True, blank=True)
    duration = models.IntegerField(null=True, blank=True)
    view_count = models.IntegerField(default=0)
    like_count = models.IntegerField(default=0)
    comment_count = models.IntegerField(default=0)
    type = models.CharField(max_length=20, choices=VIDEO_TYPES, default='video')
    is_premium = models.BooleanField(default=False)
    is_ppv = models.BooleanField(default=False)
    ppv_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_published = models.BooleanField(default=True)
    tags = models.JSONField(default=list)
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='videos'
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='videos'
    )
    watermark_enabled = models.BooleanField(default=False)
    MODERATION_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('flagged', 'Flagged'),
    ]
    moderation_status = models.CharField(max_length=20, choices=MODERATION_CHOICES, default='approved')
    moderation_note = models.TextField(default='', blank=True)
    moderated_at = models.DateTimeField(null=True, blank=True)
    moderated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='moderated_videos'
    )
    scheduled_publish_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'videos'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_published', '-created_at'], name='video_pub_date_idx'),
            models.Index(fields=['is_published', '-view_count'], name='video_pub_views_idx'),
            models.Index(fields=['is_published', 'type', '-created_at'], name='video_pub_type_idx'),
            models.Index(fields=['creator', 'is_published'], name='video_creator_pub_idx'),
        ]

    def __str__(self):
        return self.title


class VideoLike(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='video_likes')
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'video_likes'
        unique_together = ('user', 'video')


class VideoBookmark(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bookmarks')
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='bookmarks')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'video_bookmarks'
        unique_together = ('user', 'video')


class WatchHistory(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='watch_history')
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='watch_history')
    watch_time = models.IntegerField(default=0)
    completion_rate = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'watch_history'


class VideoReport(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('resolved', 'Resolved'), ('dismissed', 'Dismissed')]
    CONTENT_TYPES = [('video', 'Video'), ('comment', 'Comment'), ('user', 'User')]

    content_type = models.CharField(max_length=20, choices=CONTENT_TYPES, default='video')
    video = models.ForeignKey(Video, on_delete=models.CASCADE, null=True, blank=True, related_name='reports')
    comment_id = models.IntegerField(null=True, blank=True)
    reported_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reports_against'
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submitted_reports'
    )
    reason = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_note = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'video_reports'


class VideoPlayer(models.Model):
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='players')
    label = models.CharField(max_length=200)
    embed_url = models.TextField()
    player_type = models.CharField(max_length=50, default='iframe')
    is_default = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'video_players'


class VideoSubtitle(models.Model):
    MODERATION_CHOICES = [
        ('approved', 'Onaylandı'),
        ('pending', 'Beklemede'),
        ('rejected', 'Reddedildi'),
    ]

    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='subtitles')
    language = models.CharField(max_length=50)
    label = models.CharField(max_length=100)
    vtt_content = models.TextField()
    is_auto_generated = models.BooleanField(default=False)
    moderation_status = models.CharField(max_length=20, choices=MODERATION_CHOICES, default='approved')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'video_subtitles'
        unique_together = ('video', 'language')


class VideoDownload(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='downloads')
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='downloads')
    quality = models.CharField(max_length=20, default='720p')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'video_downloads'


class Comment(models.Model):
    content = models.TextField()
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='comments')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    like_count = models.IntegerField(default=0)
    reply_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'comments'
        ordering = ['-created_at']


class CommentLike(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, related_name='likes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'comment_likes'
        unique_together = ('user', 'comment')


class Playlist(models.Model):
    title = models.CharField(max_length=500)
    description = models.TextField(null=True, blank=True)
    thumbnail_url = models.TextField(null=True, blank=True)
    is_public = models.BooleanField(default=True)
    video_count = models.IntegerField(default=0)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='playlists')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'playlists'


class PlaylistVideo(models.Model):
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE, related_name='playlist_videos')
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='in_playlists')
    position = models.IntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'playlist_videos'
        unique_together = ('playlist', 'video')


class Ad(models.Model):
    AD_TYPES = [('banner', 'Banner'), ('video', 'Video'), ('popup', 'Popup')]
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=20, choices=AD_TYPES, default='banner')
    category = models.CharField(max_length=100, default='general')
    position = models.CharField(max_length=100, default='home_top')
    image_url = models.TextField(null=True, blank=True)
    video_url = models.TextField(null=True, blank=True)
    target_url = models.TextField()
    script_code = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    impressions = models.IntegerField(default=0)
    clicks = models.IntegerField(default=0)
    daily_budget = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    total_budget = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ads'


class CustomPage(models.Model):
    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=300)
    content = models.TextField()
    is_published = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'custom_pages'


class WatermarkSettings(models.Model):
    POSITION_CHOICES = [
        ('top-left', 'Top Left'), ('top-right', 'Top Right'),
        ('bottom-left', 'Bottom Left'), ('bottom-right', 'Bottom Right'),
        ('center', 'Center'),
    ]
    SIZE_CHOICES = [('small', 'Small'), ('medium', 'Medium'), ('large', 'Large')]

    is_enabled = models.BooleanField(default=False)
    image_url = models.TextField(null=True, blank=True)
    text = models.CharField(max_length=200, default='Prnhbbbb')
    use_image = models.BooleanField(default=False)
    position = models.CharField(max_length=20, choices=POSITION_CHOICES, default='bottom-right')
    size = models.CharField(max_length=20, choices=SIZE_CHOICES, default='medium')
    opacity = models.FloatField(default=0.4)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'watermark_settings'


class AutoCategoryRule(models.Model):
    keyword = models.CharField(max_length=200)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='auto_rules')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'auto_category_rules'
