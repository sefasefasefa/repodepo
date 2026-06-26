from django.db import models
from django.conf import settings


ADAPTER_CHOICES = [
    ('generic_webhook', 'Generic Webhook (POST JSON)'),
    ('multipart_form', 'Multipart Form Upload'),
    ('manual', 'Manual / No automation'),
]

PROVIDER_CATALOG = [
    # +18 içeriği kabul eden video host servisleri
    {'key': 'streamtape',   'name': 'StreamTape',    'acceptsAdult': True,  'baseUrl': 'https://streamtape.com',      'color': '#e8a000', 'letter': 'ST'},
    {'key': 'doodstream',   'name': 'DoodStream',    'acceptsAdult': True,  'baseUrl': 'https://dood.pm',             'color': '#6c5ce7', 'letter': 'DS'},
    {'key': 'mixdrop',      'name': 'Mixdrop',       'acceptsAdult': True,  'baseUrl': 'https://mixdrop.ag',          'color': '#00b894', 'letter': 'MD'},
    {'key': 'vidoza',       'name': 'Vidoza',        'acceptsAdult': True,  'baseUrl': 'https://vidoza.net',          'color': '#e17055', 'letter': 'VZ'},
    {'key': 'upstream',     'name': 'Upstream',      'acceptsAdult': True,  'baseUrl': 'https://upstream.to',         'color': '#0984e3', 'letter': 'US'},
    {'key': 'filemoon',     'name': 'FileMoon',      'acceptsAdult': True,  'baseUrl': 'https://filemoon.sx',         'color': '#fd79a8', 'letter': 'FM'},
    {'key': 'streamwish',   'name': 'StreamWish',    'acceptsAdult': True,  'baseUrl': 'https://streamwish.com',      'color': '#a29bfe', 'letter': 'SW'},
    {'key': 'vidhide',      'name': 'VidHide',       'acceptsAdult': True,  'baseUrl': 'https://vidhide.com',         'color': '#55efc4', 'letter': 'VH'},
    {'key': 'voe',          'name': 'Voe.sx',        'acceptsAdult': True,  'baseUrl': 'https://voe.sx',              'color': '#00cec9', 'letter': 'VO'},
    {'key': 'luluvdo',      'name': 'Luluvdo',       'acceptsAdult': True,  'baseUrl': 'https://luluvdo.com',         'color': '#e84393', 'letter': 'LL'},
    {'key': 'dropload',     'name': 'Dropload',      'acceptsAdult': True,  'baseUrl': 'https://dropload.io',         'color': '#74b9ff', 'letter': 'DL'},
    {'key': 'uqload',       'name': 'Uqload',        'acceptsAdult': True,  'baseUrl': 'https://uqload.io',           'color': '#ff7675', 'letter': 'UQ'},
    {'key': 'streamhide',   'name': 'StreamHide',    'acceptsAdult': True,  'baseUrl': 'https://streamhide.com',      'color': '#b2bec3', 'letter': 'SH'},
    {'key': 'embedsito',    'name': 'Embedsito',     'acceptsAdult': True,  'baseUrl': 'https://embedsito.com',       'color': '#fdcb6e', 'letter': 'ES'},
    {'key': 'vidlox',       'name': 'Vidlox',        'acceptsAdult': True,  'baseUrl': 'https://vidlox.me',           'color': '#d63031', 'letter': 'VL'},
    {'key': 'supervideo',   'name': 'SuperVideo',    'acceptsAdult': True,  'baseUrl': 'https://supervideo.tv',       'color': '#6d4c41', 'letter': 'SV'},
    # Genel (yetişkin içerik kabul etmeyen) video host servisleri
    {'key': 'streamable',   'name': 'Streamable',    'acceptsAdult': False, 'baseUrl': 'https://streamable.com',      'color': '#00b0ff', 'letter': 'SA'},
    {'key': 'vimeo',        'name': 'Vimeo',         'acceptsAdult': False, 'baseUrl': 'https://vimeo.com',           'color': '#1ab7ea', 'letter': 'VM'},
    {'key': 'dailymotion',  'name': 'Dailymotion',   'acceptsAdult': False, 'baseUrl': 'https://www.dailymotion.com', 'color': '#0066ff', 'letter': 'DM'},
    {'key': 'youtube',      'name': 'YouTube',       'acceptsAdult': False, 'baseUrl': 'https://www.youtube.com',     'color': '#ff0000', 'letter': 'YT'},
    {'key': 'rumble',       'name': 'Rumble',        'acceptsAdult': False, 'baseUrl': 'https://rumble.com',          'color': '#85c742', 'letter': 'RU'},
    {'key': 'odysee',       'name': 'Odysee',        'acceptsAdult': False, 'baseUrl': 'https://odysee.com',          'color': '#ef1970', 'letter': 'OD'},
    {'key': 'catbox',       'name': 'Catbox.moe',    'acceptsAdult': False, 'baseUrl': 'https://catbox.moe',          'color': '#636e72', 'letter': 'CB'},
    {'key': 'gofile',       'name': 'Gofile',        'acceptsAdult': False, 'baseUrl': 'https://gofile.io',           'color': '#00b894', 'letter': 'GF'},
    {'key': 'filebin',      'name': 'Filebin',       'acceptsAdult': False, 'baseUrl': 'https://filebin.net',         'color': '#2d3436', 'letter': 'FB'},
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
