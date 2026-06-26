from django.db import models
from django.conf import settings


ADAPTER_CHOICES = [
    ('generic_webhook', 'Generic Webhook (POST JSON)'),
    ('multipart_form', 'Multipart Form Upload'),
    ('manual', 'Manual / No automation'),
]

PROVIDER_CATALOG = [
    # +18 kabul eden platformlar
    {'key': 'pornhub',    'name': 'Pornhub',     'acceptsAdult': True,  'baseUrl': 'https://www.pornhub.com',   'color': '#ff9000', 'letter': 'PH'},
    {'key': 'xvideos',   'name': 'xVideos',      'acceptsAdult': True,  'baseUrl': 'https://www.xvideos.com',   'color': '#cc0000', 'letter': 'XV'},
    {'key': 'xhamster',  'name': 'xHamster',     'acceptsAdult': True,  'baseUrl': 'https://xhamster.com',      'color': '#f18b00', 'letter': 'XH'},
    {'key': 'xnxx',      'name': 'XNXX',         'acceptsAdult': True,  'baseUrl': 'https://www.xnxx.com',      'color': '#009900', 'letter': 'XN'},
    {'key': 'spankbang', 'name': 'SpankBang',    'acceptsAdult': True,  'baseUrl': 'https://spankbang.com',     'color': '#e84040', 'letter': 'SB'},
    {'key': 'redtube',   'name': 'RedTube',      'acceptsAdult': True,  'baseUrl': 'https://www.redtube.com',   'color': '#e01010', 'letter': 'RT'},
    {'key': 'youporn',   'name': 'YouPorn',      'acceptsAdult': True,  'baseUrl': 'https://www.youporn.com',   'color': '#0066cc', 'letter': 'YP'},
    {'key': 'tube8',     'name': 'Tube8',        'acceptsAdult': True,  'baseUrl': 'https://www.tube8.com',     'color': '#ff5500', 'letter': 'T8'},
    {'key': 'eporner',   'name': 'Eporner',      'acceptsAdult': True,  'baseUrl': 'https://www.eporner.com',   'color': '#8b00ff', 'letter': 'EP'},
    {'key': 'beeg',      'name': 'Beeg',         'acceptsAdult': True,  'baseUrl': 'https://beeg.com',          'color': '#d40000', 'letter': 'BG'},
    {'key': 'hclips',    'name': 'HClips',       'acceptsAdult': True,  'baseUrl': 'https://hclips.com',        'color': '#ff6600', 'letter': 'HC'},
    {'key': 'okxxx',     'name': 'OK.xxx',       'acceptsAdult': True,  'baseUrl': 'https://ok.xxx',            'color': '#cc3300', 'letter': 'OK'},
    {'key': 'tnaflix',   'name': 'TNAFlix',      'acceptsAdult': True,  'baseUrl': 'https://www.tnaflix.com',   'color': '#ff4400', 'letter': 'TN'},
    {'key': 'porntrex',  'name': 'Porntrex',     'acceptsAdult': True,  'baseUrl': 'https://www.porntrex.com',  'color': '#aa0000', 'letter': 'PX'},
    {'key': '4tube',     'name': '4Tube',        'acceptsAdult': True,  'baseUrl': 'https://www.4tube.com',     'color': '#ff2200', 'letter': '4T'},
    # Genel platformlar
    {'key': 'youtube',      'name': 'YouTube',      'acceptsAdult': False, 'baseUrl': 'https://www.youtube.com',     'color': '#ff0000', 'letter': 'YT'},
    {'key': 'dailymotion',  'name': 'Dailymotion',  'acceptsAdult': False, 'baseUrl': 'https://www.dailymotion.com', 'color': '#0066ff', 'letter': 'DM'},
    {'key': 'vimeo',        'name': 'Vimeo',        'acceptsAdult': False, 'baseUrl': 'https://vimeo.com',           'color': '#1ab7ea', 'letter': 'VM'},
    {'key': 'rumble',       'name': 'Rumble',        'acceptsAdult': False, 'baseUrl': 'https://rumble.com',          'color': '#85c742', 'letter': 'RU'},
    {'key': 'odysee',       'name': 'Odysee',       'acceptsAdult': False, 'baseUrl': 'https://odysee.com',          'color': '#ef1970', 'letter': 'OD'},
    {'key': 'twitch',       'name': 'Twitch',       'acceptsAdult': False, 'baseUrl': 'https://www.twitch.tv',       'color': '#9146ff', 'letter': 'TW'},
    {'key': 'facebook',     'name': 'Facebook',     'acceptsAdult': False, 'baseUrl': 'https://www.facebook.com',    'color': '#1877f2', 'letter': 'FB'},
    {'key': 'twitter',      'name': 'X / Twitter',  'acceptsAdult': False, 'baseUrl': 'https://x.com',               'color': '#000000', 'letter': 'X'},
    {'key': 'tiktok',       'name': 'TikTok',       'acceptsAdult': False, 'baseUrl': 'https://www.tiktok.com',      'color': '#010101', 'letter': 'TK'},
    {'key': 'instagram',    'name': 'Instagram',    'acceptsAdult': False, 'baseUrl': 'https://www.instagram.com',   'color': '#c13584', 'letter': 'IG'},
]


class CrossPostSite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name='crosspost_sites')
    name = models.CharField(max_length=120)
    provider_key = models.CharField(max_length=64, blank=True, default='',
                                    help_text='Katalog sağlayıcı anahtarı (örn: pornhub, youtube)')
    accepts_adult = models.BooleanField(default=False,
                                        help_text='+18 içerik kabul eder mi?')
    provider_color = models.CharField(max_length=16, blank=True, default='')
    provider_letter = models.CharField(max_length=4, blank=True, default='')
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
            'providerKey': self.provider_key,
            'acceptsAdult': self.accepts_adult,
            'providerColor': self.provider_color,
            'providerLetter': self.provider_letter,
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
