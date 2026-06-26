from django.db import models
from django.conf import settings


ADAPTER_CHOICES = [
    # Gerçek API entegrasyonları
    ('streamtape',   'StreamTape API'),
    ('doodstream',   'DoodStream API'),
    ('mixdrop',      'Mixdrop API'),
    ('vidoza',       'Vidoza API'),
    ('filemoon',     'FileMoon API'),
    ('streamwish',   'StreamWish API'),
    ('voe',          'Voe.sx API'),
    ('upstream',     'Upstream API'),
    ('vidhide',      'VidHide API'),
    ('luluvdo',      'Luluvdo API'),
    ('uqload',       'Uqload API'),
    ('streamhide',   'StreamHide API'),
    ('supervideo',   'SuperVideo API'),
    ('dropload',     'Dropload API'),
    ('embedsito',    'Embedsito API'),
    ('vidlox',       'Vidlox API'),
    ('streamlare',   'Streamlare API'),
    ('clipwatching', 'ClipWatching API'),
    ('streamsb',     'StreamSB API'),
    ('hxfile',       'HXFile API'),
    ('vidplay',      'VidPlay API'),
    ('nxbex',        'Nxbex API'),
    ('dropgalaxy',   'DropGalaxy API'),
    ('evoload',      'Evoload API'),
    ('fembed',       'Fembed API'),
    ('hotlinking',   'Hotlinking API'),
    # Yeni +18 dostu platformlar
    ('filelions',    'FileLions API'),
    ('vidmoly',      'VidMoly API'),
    ('streamhub',    'StreamHub API'),
    ('videovard',    'VideoVard API'),
    ('waaw',         'Waaw.tv API'),
    ('upvid',        'UpVid API'),
    ('vtube',        'VTube API'),
    ('abysscdn',     'AbyssCDN API'),
    ('filebee',      'FileBee API'),
    ('vipfile',      'VipFile API'),
    ('vidmam',       'VidMam API'),
    ('moonvid',      'MoonVid API'),
    ('gobig',        'GoBig API'),
    ('jetload',      'JetLoad API'),
    ('sendvid',      'SendVid API'),
    ('rapidvideo',   'RapidVideo API'),
    ('vidcrypt',     'VidCrypt API'),
    ('embedrise',    'EmbedRise API'),
    ('kvid',         'KVid API'),
    ('megaup',       'MegaUp API'),
    # Genel
    ('generic_webhook', 'Generic Webhook (POST JSON)'),
    ('multipart_form',  'Multipart Form Upload'),
    ('manual',          'Manuel (otomatik yok)'),
]

# provider_key → kullanılacak adapter
PROVIDER_DEFAULT_ADAPTER = {
    'streamtape':   'streamtape',
    'doodstream':   'doodstream',
    'mixdrop':      'mixdrop',
    'vidoza':       'vidoza',
    'filemoon':     'filemoon',
    'streamwish':   'streamwish',
    'voe':          'voe',
    'upstream':     'upstream',
    'vidhide':      'vidhide',
    'luluvdo':      'luluvdo',
    'uqload':       'uqload',
    'streamhide':   'streamhide',
    'supervideo':   'supervideo',
    'dropload':     'dropload',
    'embedsito':    'embedsito',
    'vidlox':       'vidlox',
    'streamlare':   'streamlare',
    'clipwatching': 'clipwatching',
    'streamsb':     'streamsb',
    'hxfile':       'hxfile',
    'vidplay':      'vidplay',
    'nxbex':        'nxbex',
    'dropgalaxy':   'dropgalaxy',
    'evoload':      'evoload',
    'fembed':       'fembed',
    'hotlinking':   'hotlinking',
    'filelions':    'filelions',
    'vidmoly':      'vidmoly',
    'streamhub':    'streamhub',
    'videovard':    'videovard',
    'waaw':         'waaw',
    'upvid':        'upvid',
    'vtube':        'vtube',
    'abysscdn':     'abysscdn',
    'filebee':      'filebee',
    'vipfile':      'vipfile',
    'vidmam':       'vidmam',
    'moonvid':      'moonvid',
    'gobig':        'gobig',
    'jetload':      'jetload',
    'sendvid':      'sendvid',
    'rapidvideo':   'rapidvideo',
    'vidcrypt':     'vidcrypt',
    'embedrise':    'embedrise',
    'kvid':         'kvid',
    'megaup':       'megaup',
}

PROVIDER_CATALOG = [
    # +18 içeriği kabul eden video host servisleri
    {'key': 'streamtape',   'name': 'StreamTape',    'acceptsAdult': True, 'baseUrl': 'https://streamtape.com',       'color': '#e8a000', 'letter': 'ST'},
    {'key': 'doodstream',   'name': 'DoodStream',    'acceptsAdult': True, 'baseUrl': 'https://dood.pm',              'color': '#6c5ce7', 'letter': 'DS'},
    {'key': 'mixdrop',      'name': 'Mixdrop',       'acceptsAdult': True, 'baseUrl': 'https://mixdrop.ag',           'color': '#00b894', 'letter': 'MD'},
    {'key': 'vidoza',       'name': 'Vidoza',        'acceptsAdult': True, 'baseUrl': 'https://vidoza.net',           'color': '#e17055', 'letter': 'VZ'},
    {'key': 'upstream',     'name': 'Upstream',      'acceptsAdult': True, 'baseUrl': 'https://upstream.to',          'color': '#0984e3', 'letter': 'US'},
    {'key': 'filemoon',     'name': 'FileMoon',      'acceptsAdult': True, 'baseUrl': 'https://filemoon.sx',          'color': '#fd79a8', 'letter': 'FM'},
    {'key': 'streamwish',   'name': 'StreamWish',    'acceptsAdult': True, 'baseUrl': 'https://streamwish.com',       'color': '#a29bfe', 'letter': 'SW'},
    {'key': 'vidhide',      'name': 'VidHide',       'acceptsAdult': True, 'baseUrl': 'https://vidhide.com',          'color': '#55efc4', 'letter': 'VH'},
    {'key': 'voe',          'name': 'Voe.sx',        'acceptsAdult': True, 'baseUrl': 'https://voe.sx',               'color': '#00cec9', 'letter': 'VO'},
    {'key': 'luluvdo',      'name': 'Luluvdo',       'acceptsAdult': True, 'baseUrl': 'https://luluvdo.com',          'color': '#e84393', 'letter': 'LL'},
    {'key': 'dropload',     'name': 'Dropload',      'acceptsAdult': True, 'baseUrl': 'https://dropload.io',          'color': '#74b9ff', 'letter': 'DL'},
    {'key': 'uqload',       'name': 'Uqload',        'acceptsAdult': True, 'baseUrl': 'https://uqload.io',            'color': '#ff7675', 'letter': 'UQ'},
    {'key': 'streamhide',   'name': 'StreamHide',    'acceptsAdult': True, 'baseUrl': 'https://streamhide.com',       'color': '#b2bec3', 'letter': 'SH'},
    {'key': 'embedsito',    'name': 'Embedsito',     'acceptsAdult': True, 'baseUrl': 'https://embedsito.com',        'color': '#fdcb6e', 'letter': 'ES'},
    {'key': 'vidlox',       'name': 'Vidlox',        'acceptsAdult': True, 'baseUrl': 'https://vidlox.me',            'color': '#d63031', 'letter': 'VL'},
    {'key': 'supervideo',   'name': 'SuperVideo',    'acceptsAdult': True, 'baseUrl': 'https://supervideo.tv',        'color': '#6d4c41', 'letter': 'SV'},
    {'key': 'streamlare',   'name': 'Streamlare',    'acceptsAdult': True, 'baseUrl': 'https://streamlare.com',       'color': '#e040fb', 'letter': 'SL'},
    {'key': 'clipwatching', 'name': 'ClipWatching',  'acceptsAdult': True, 'baseUrl': 'https://clipwatching.com',     'color': '#ff6b35', 'letter': 'CW'},
    {'key': 'streamsb',     'name': 'StreamSB',      'acceptsAdult': True, 'baseUrl': 'https://streamsb.net',         'color': '#26c6da', 'letter': 'SB'},
    {'key': 'hxfile',       'name': 'HXFile',        'acceptsAdult': True, 'baseUrl': 'https://hxfile.ch',            'color': '#ff8f00', 'letter': 'HX'},
    {'key': 'vidplay',      'name': 'VidPlay',       'acceptsAdult': True, 'baseUrl': 'https://vidplay.online',       'color': '#43a047', 'letter': 'VP'},
    {'key': 'nxbex',        'name': 'Nxbex',         'acceptsAdult': True, 'baseUrl': 'https://nxbex.com',            'color': '#8e24aa', 'letter': 'NX'},
    {'key': 'dropgalaxy',   'name': 'DropGalaxy',    'acceptsAdult': True, 'baseUrl': 'https://dropgalaxy.com',       'color': '#1565c0', 'letter': 'DG'},
    {'key': 'evoload',      'name': 'Evoload',       'acceptsAdult': True, 'baseUrl': 'https://evoload.io',           'color': '#f57f17', 'letter': 'EV'},
    {'key': 'fembed',       'name': 'Fembed',        'acceptsAdult': True, 'baseUrl': 'https://www.fembed.com',       'color': '#c62828', 'letter': 'FB'},
    {'key': 'hotlinking',   'name': 'Hotlinking',    'acceptsAdult': True, 'baseUrl': 'https://hotlinking.co',        'color': '#558b2f', 'letter': 'HL'},
    # Yeni +18 dostu platformlar
    {'key': 'filelions',    'name': 'FileLions',     'acceptsAdult': True, 'baseUrl': 'https://filelions.com',        'color': '#ff6f00', 'letter': 'FL'},
    {'key': 'vidmoly',      'name': 'VidMoly',       'acceptsAdult': True, 'baseUrl': 'https://vidmoly.to',           'color': '#7b1fa2', 'letter': 'VM'},
    {'key': 'streamhub',    'name': 'StreamHub',     'acceptsAdult': True, 'baseUrl': 'https://streamhub.to',         'color': '#0097a7', 'letter': 'SHB'},
    {'key': 'videovard',    'name': 'VideoVard',     'acceptsAdult': True, 'baseUrl': 'https://videovard.sx',         'color': '#388e3c', 'letter': 'VV'},
    {'key': 'waaw',         'name': 'Waaw.tv',       'acceptsAdult': True, 'baseUrl': 'https://waaw.tv',              'color': '#f06292', 'letter': 'WW'},
    {'key': 'upvid',        'name': 'UpVid',         'acceptsAdult': True, 'baseUrl': 'https://upvid.co',             'color': '#5c6bc0', 'letter': 'UV'},
    {'key': 'vtube',        'name': 'VTube',         'acceptsAdult': True, 'baseUrl': 'https://vtube.network',        'color': '#ef5350', 'letter': 'VT'},
    {'key': 'abysscdn',     'name': 'AbyssCDN',      'acceptsAdult': True, 'baseUrl': 'https://abysscdn.com',         'color': '#263238', 'letter': 'AB'},
    {'key': 'filebee',      'name': 'FileBee',       'acceptsAdult': True, 'baseUrl': 'https://filebee.to',           'color': '#fbc02d', 'letter': 'FBE'},
    {'key': 'vipfile',      'name': 'VipFile',       'acceptsAdult': True, 'baseUrl': 'https://vipfile.cc',           'color': '#ad1457', 'letter': 'VF'},
    {'key': 'vidmam',       'name': 'VidMam',        'acceptsAdult': True, 'baseUrl': 'https://vidmam.com',           'color': '#00838f', 'letter': 'VMA'},
    {'key': 'moonvid',      'name': 'MoonVid',       'acceptsAdult': True, 'baseUrl': 'https://moonvid.cc',           'color': '#4a148c', 'letter': 'MV'},
    {'key': 'gobig',        'name': 'GoBig',         'acceptsAdult': True, 'baseUrl': 'https://gobig.cc',             'color': '#1b5e20', 'letter': 'GB'},
    {'key': 'jetload',      'name': 'JetLoad',       'acceptsAdult': True, 'baseUrl': 'https://jetload.net',          'color': '#bf360c', 'letter': 'JL'},
    {'key': 'sendvid',      'name': 'SendVid',       'acceptsAdult': True, 'baseUrl': 'https://sendvid.com',          'color': '#37474f', 'letter': 'SV2'},
    {'key': 'rapidvideo',   'name': 'RapidVideo',    'acceptsAdult': True, 'baseUrl': 'https://rapidvideo.com',       'color': '#e65100', 'letter': 'RV'},
    {'key': 'vidcrypt',     'name': 'VidCrypt',      'acceptsAdult': True, 'baseUrl': 'https://vidcrypt.com',         'color': '#006064', 'letter': 'VC'},
    {'key': 'embedrise',    'name': 'EmbedRise',     'acceptsAdult': True, 'baseUrl': 'https://embedrise.com',        'color': '#880e4f', 'letter': 'ER'},
    {'key': 'kvid',         'name': 'KVid',          'acceptsAdult': True, 'baseUrl': 'https://kvid.pro',             'color': '#33691e', 'letter': 'KV'},
    {'key': 'megaup',       'name': 'MegaUp',        'acceptsAdult': True, 'baseUrl': 'https://megaup.net',           'color': '#0d47a1', 'letter': 'MU'},
]


class CrossPostSite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                             related_name='crosspost_sites')
    name = models.CharField(max_length=120)
    provider_key = models.CharField(max_length=64, blank=True, default='',
                                    help_text='Katalog sağlayıcı anahtarı (örn: streamtape, youtube)')
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
