from django.db import models
from django.conf import settings


class Follow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='following_set'
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='followers_set'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'follows'
        unique_together = ('follower', 'following')


class Story(models.Model):
    MEDIA_TYPES = [('image', 'Image'), ('video', 'Video')]

    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='stories')
    media_url = models.TextField()
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES, default='image')
    thumbnail_url = models.TextField(null=True, blank=True)
    caption = models.TextField(null=True, blank=True)
    is_premium = models.BooleanField(default=False)
    view_count = models.IntegerField(default=0)
    duration = models.IntegerField(default=5)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stories'
        ordering = ['-created_at']


class StoryView(models.Model):
    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name='views')
    viewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='story_views')
    viewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'story_views'


class BadgeDefinition(models.Model):
    CRITERIA_CHOICES = [
        ('manual', 'Manual'), ('video_count', 'Video Count'), ('view_count', 'View Count'),
        ('follower_count', 'Follower Count'), ('tip_given', 'Tip Given'),
        ('tip_received', 'Tip Received'), ('subscriber', 'Subscriber'),
        ('verified', 'Verified'), ('creator_role', 'Creator Role'),
        ('comment_count', 'Comment Count'), ('live_stream', 'Live Stream'),
    ]

    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=200)
    description = models.TextField()
    icon = models.CharField(max_length=10, default='🏅')
    color = models.CharField(max_length=20, default='#a855f7')
    criteria = models.CharField(max_length=30, choices=CRITERIA_CHOICES, default='manual')
    threshold = models.IntegerField(default=1)
    is_enabled = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'badge_definitions'


class UserBadge(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='badges')
    badge = models.ForeignKey(BadgeDefinition, on_delete=models.CASCADE)
    is_displayed = models.BooleanField(default=True)
    awarded_by_admin = models.BooleanField(default=False)
    note = models.TextField(null=True, blank=True)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_badges'


class BadgeSystemSettings(models.Model):
    is_active = models.BooleanField(default=False)
    auto_award_enabled = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'badge_system_settings'


class CreatorApplication(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='creator_applications')
    reason = models.TextField()
    portfolio_url = models.TextField(null=True, blank=True)
    social_media = models.JSONField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_note = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'creator_applications'


class CustomRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'), ('accepted', 'Accepted'), ('rejected', 'Rejected'),
        ('completed', 'Completed'), ('expired', 'Expired'), ('cancelled', 'Cancelled'),
    ]

    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_requests'
    )
    to_creator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_requests'
    )
    title = models.CharField(max_length=300)
    description = models.TextField()
    token_offer = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    response_note = models.TextField(null=True, blank=True)
    completed_video_id = models.IntegerField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'custom_requests'


class CreatorUploadLimit(models.Model):
    creator = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='upload_limit'
    )
    max_file_size_mb = models.IntegerField(default=2048)
    max_duration_sec = models.IntegerField(default=3600)
    max_daily_uploads = models.IntegerField(default=5)
    max_resolution = models.CharField(max_length=20, default='4K')
    allowed_types = models.JSONField(default=list)
    premium_allowed = models.BooleanField(default=True)
    ppv_allowed = models.BooleanField(default=True)
    notes = models.TextField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'creator_upload_limits'
