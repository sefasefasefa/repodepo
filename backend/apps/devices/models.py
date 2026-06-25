from django.conf import settings
from django.db import models
from apps.videos.models import Video


class Device(models.Model):
    """A browser/device the site has identified.

    We never see the OS MAC address (browsers refuse) and we deliberately
    don't use IP (VPN noise). Identification is a combination of:

      - device_id : a UUID minted on first visit and kept in localStorage.
      - fingerprint: stable hash of UA + screen + tz + canvas + audio.
                     Used to re-link the same physical device when its
                     localStorage gets wiped.
    """
    device_id = models.CharField(max_length=64, unique=True)
    fingerprint = models.CharField(max_length=64, db_index=True, blank=True, default='')
    user_agent = models.TextField(blank=True, default='')
    screen = models.CharField(max_length=32, blank=True, default='')
    timezone = models.CharField(max_length=64, blank=True, default='')
    lang = models.CharField(max_length=16, blank=True, default='')
    platform = models.CharField(max_length=64, blank=True, default='')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='devices',
    )
    interaction_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'devices'

    def __str__(self):
        return f"Device({self.device_id[:8]}…)"


class DeviceInteraction(models.Model):
    """A single device-video signal used to build per-device recommendations."""
    KIND_CHOICES = [
        ('view',     'View'),         # weight 1
        ('watch',    'Watch chunk'),  # weight ~seconds/30
        ('complete', 'Completed'),    # weight 3
        ('like',     'Liked'),        # weight 5
        ('bookmark', 'Bookmarked'),   # weight 4
        ('share',    'Shared'),       # weight 4
    ]
    device = models.ForeignKey(Device, on_delete=models.CASCADE, related_name='interactions')
    video = models.ForeignKey(Video, on_delete=models.CASCADE, related_name='device_interactions')
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    weight = models.FloatField(default=1.0)
    seconds = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'device_interactions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['device', '-created_at']),
            models.Index(fields=['video']),
        ]
