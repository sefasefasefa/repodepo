from django.db import models
from django.conf import settings


class LiveStream(models.Model):
    STATUS_CHOICES = [('idle', 'Idle'), ('live', 'Live'), ('ended', 'Ended')]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='live_streams')
    title = models.CharField(max_length=300, default='Canlı Yayın')
    description = models.TextField(default='')
    thumbnail = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='idle')
    stream_key = models.CharField(max_length=255, unique=True)
    hls_url = models.TextField(null=True, blank=True)
    chat_enabled = models.BooleanField(default=True)
    poll_question = models.TextField(null=True, blank=True)
    poll_options = models.JSONField(default=list)
    poll_votes = models.JSONField(default=list)
    goal_title = models.CharField(max_length=200, null=True, blank=True)
    goal_target = models.IntegerField(null=True, blank=True)
    goal_progress = models.IntegerField(default=0)
    is_recorded = models.BooleanField(default=False)
    viewer_count = models.IntegerField(default=0)
    peak_viewers = models.IntegerField(default=0)
    total_views = models.IntegerField(default=0)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'live_streams'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} - {self.title}'


class LiveChatMessage(models.Model):
    stream = models.ForeignKey(LiveStream, on_delete=models.CASCADE, related_name='chat_messages')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField()
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'live_chat_messages'
        ordering = ['-created_at']


class LiveViewer(models.Model):
    stream = models.ForeignKey(LiveStream, on_delete=models.CASCADE, related_name='viewers')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    session_token = models.CharField(max_length=255, null=True, blank=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'live_viewers'


class LivePollVote(models.Model):
    stream = models.ForeignKey(LiveStream, on_delete=models.CASCADE, related_name='poll_votes_set')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    session_token = models.CharField(max_length=255, null=True, blank=True)
    option_index = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'live_poll_votes'
