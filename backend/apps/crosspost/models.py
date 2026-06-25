from django.db import models
from django.conf import settings


ADAPTER_CHOICES = [
    ('generic_webhook', 'Generic Webhook (POST JSON)'),
    ('multipart_form', 'Multipart Form Upload'),
    ('manual', 'Manual / No automation'),
]


class CrossPostSite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name='crosspost_sites')
    name = models.CharField(max_length=120)
    base_url = models.CharField(max_length=500, blank=True, default='')
    upload_endpoint = models.CharField(max_length=500, blank=True, default='',
                                       help_text='Full URL the video payload is POSTed to.')
    login_endpoint = models.CharField(max_length=500, blank=True, default='')
    adapter = models.CharField(max_length=32, choices=ADAPTER_CHOICES,
                               default='generic_webhook')
    username = models.CharField(max_length=200, blank=True, default='')
    password = models.CharField(max_length=500, blank=True, default='')
    api_key = models.CharField(max_length=500, blank=True, default='')
    extra_headers = models.JSONField(default=dict, blank=True)
    enabled = models.BooleanField(default=True)
    auto_post = models.BooleanField(default=True,
                                    help_text='Cross-post otomatik tetiklensin mi?')
    last_login_ok = models.BooleanField(default=False)
    last_error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def to_dict(self, include_secret=False):
        return {
            'id': self.id,
            'name': self.name,
            'baseUrl': self.base_url,
            'uploadEndpoint': self.upload_endpoint,
            'loginEndpoint': self.login_endpoint,
            'adapter': self.adapter,
            'username': self.username,
            'hasPassword': bool(self.password),
            'hasApiKey': bool(self.api_key),
            'password': self.password if include_secret else '',
            'apiKey': self.api_key if include_secret else '',
            'extraHeaders': self.extra_headers or {},
            'enabled': self.enabled,
            'autoPost': self.auto_post,
            'lastLoginOk': self.last_login_ok,
            'lastError': self.last_error,
        }


class CrossPostJob(models.Model):
    STATUS = [
        ('pending', 'pending'),
        ('running', 'running'),
        ('success', 'success'),
        ('failed', 'failed'),
        ('skipped', 'skipped'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name='crosspost_jobs')
    site = models.ForeignKey(CrossPostSite, on_delete=models.CASCADE,
                             related_name='jobs')
    video = models.ForeignKey('videos.Video', on_delete=models.CASCADE,
                              related_name='crosspost_jobs')
    status = models.CharField(max_length=16, choices=STATUS, default='pending')
    attempts = models.PositiveIntegerField(default=0)
    response_code = models.IntegerField(null=True, blank=True)
    response_text = models.TextField(blank=True, default='')
    remote_url = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def to_dict(self):
        return {
            'id': self.id,
            'siteId': self.site_id,
            'siteName': self.site.name if self.site_id else '',
            'videoId': self.video_id,
            'status': self.status,
            'attempts': self.attempts,
            'responseCode': self.response_code,
            'responseText': (self.response_text or '')[:500],
            'remoteUrl': self.remote_url,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'finishedAt': self.finished_at.isoformat() if self.finished_at else None,
        }
