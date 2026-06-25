from django.db import models
from django.conf import settings


class Conversation(models.Model):
    user1 = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversations_as_user1'
    )
    user2 = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='conversations_as_user2'
    )
    last_message_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'dm_conversations'
        ordering = ['-last_message_at']


class Message(models.Model):
    MESSAGE_TYPES = [('text', 'Text'), ('image', 'Image'), ('audio', 'Audio'), ('call', 'Call')]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    content = models.TextField()
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default='text')
    audio_data = models.TextField(null=True, blank=True)
    call_duration = models.IntegerField(null=True, blank=True)
    is_read = models.BooleanField(default=False)
    deleted_by_sender = models.BooleanField(default=False)
    deleted_by_receiver = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'dm_messages'
        ordering = ['-created_at']


class CallSession(models.Model):
    """WebRTC signaling for in-conversation audio/video calls."""
    CALL_TYPES = [('audio', 'Audio'), ('video', 'Video')]
    STATUS_CHOICES = [
        ('ringing', 'Ringing'),
        ('active', 'Active'),
        ('ended', 'Ended'),
        ('rejected', 'Rejected'),
        ('missed', 'Missed'),
    ]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='calls')
    caller = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='outgoing_calls'
    )
    callee = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='incoming_calls'
    )
    call_type = models.CharField(max_length=10, choices=CALL_TYPES, default='audio')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ringing')
    sdp_offer = models.TextField()
    sdp_answer = models.TextField(null=True, blank=True)
    caller_ice = models.JSONField(default=list)
    callee_ice = models.JSONField(default=list)
    duration = models.IntegerField(null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'call_sessions'
        ordering = ['-started_at']
