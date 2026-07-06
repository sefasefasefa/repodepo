from django.db import models
from django.conf import settings


class SecurityAccessLog(models.Model):
    """Şüpheli/reddedilen istekleri kaydeder (403 Forbidden, 404 Not Found).

    Bot/tarayıcı trafiğini (GraphQL playground taramaları, exploit kit'leri vb.)
    admin panelindeki Güvenlik sekmesinde görünür kılmak için kullanılır.
    """
    ip_address = models.GenericIPAddressField(db_index=True)
    path = models.CharField(max_length=500)
    method = models.CharField(max_length=10, default='GET')
    status_code = models.PositiveSmallIntegerField()
    user_agent = models.CharField(max_length=500, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'security_access_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['ip_address', 'created_at']),
        ]

    def __str__(self):
        return f'{self.ip_address} {self.method} {self.path} [{self.status_code}]'


class BlockedIP(models.Model):
    """Admin panelinden manuel olarak engellenen IP adresleri.

    Bu tabloya eklenen IP'lerden gelen tüm istekler middleware tarafından
    doğrudan 403 ile reddedilir.
    """
    ip_address = models.GenericIPAddressField(unique=True, db_index=True)
    reason = models.CharField(max_length=300, blank=True, default='')
    blocked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'blocked_ips'
        ordering = ['-created_at']

    def __str__(self):
        return self.ip_address


class SiteSettings(models.Model):
    site_name = models.CharField(max_length=200, default='Soci')
    site_description = models.TextField(default='')
    logo_url = models.TextField(null=True, blank=True)
    favicon_url = models.TextField(null=True, blank=True)
    primary_color = models.CharField(max_length=20, default='#7c3aed')
    maintenance_mode = models.BooleanField(default=False)
    registration_enabled = models.BooleanField(default=True)
    creator_application_enabled = models.BooleanField(default=True)
    contact_email = models.EmailField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'site_settings'


class ApiEndpointConfig(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(default='')
    url = models.TextField()
    method = models.CharField(max_length=10, default='GET')
    headers = models.TextField(default='{}')
    body = models.TextField(default='')
    category = models.CharField(max_length=100, default='Genel')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'api_endpoint_configs'
        ordering = ['-created_at']


class ApiClient(models.Model):
    name = models.CharField(max_length=200)
    client_key = models.CharField(max_length=100, unique=True)
    client_secret = models.CharField(max_length=200)
    developer_domain = models.CharField(max_length=200, default='developer.sitelinli')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'api_clients'
        ordering = ['-created_at']


class CdnConfig(models.Model):
    provider = models.CharField(max_length=50)
    name = models.CharField(max_length=200)
    endpoint = models.TextField(null=True, blank=True)
    access_key = models.TextField(null=True, blank=True)
    secret_key = models.TextField(null=True, blank=True)
    bucket = models.CharField(max_length=200, null=True, blank=True)
    region = models.CharField(max_length=50, default='auto')
    cdn_url = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'cdn_configs'
        ordering = ['-created_at']


class IntegrationBillingSettings(models.Model):
    """Global bakiye çekme ayarları — singleton (tek satır kullanılır)."""
    CHARGE_ON_CHOICES = [
        ('upload', 'Her yükleme başına'),
        ('success', 'Yalnızca başarılı yükleme'),
    ]
    enabled = models.BooleanField(default=False)
    default_charge_amount = models.IntegerField(default=0)   # token cinsinden
    charge_on = models.CharField(max_length=20, choices=CHARGE_ON_CHOICES, default='success')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'integration_billing_settings'

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class IntegrationConfig(models.Model):
    platform = models.CharField(max_length=50)
    name = models.CharField(max_length=200)
    login = models.CharField(max_length=200, null=True, blank=True)
    key = models.TextField(null=True, blank=True)
    api_key = models.TextField(null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    auto_upload = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    upload_count = models.IntegerField(default=0)
    # ── Bakiye çekme alanları ──────────────────────────────────────────────────
    charge_enabled = models.BooleanField(default=False)   # bu entegrasyon için aktif mi?
    charge_amount = models.IntegerField(default=0)         # token/kullanım (0 = global varsayılan)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'integration_configs'
        ordering = ['-created_at']


class PaymentGateway(models.Model):
    TYPE_CHOICES = [
        ('stripe', 'Stripe'), ('paypal', 'PayPal'),
        ('crypto', 'Crypto'), ('papara', 'Papara'),
    ]
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    name = models.CharField(max_length=200)
    public_key = models.TextField(null=True, blank=True)
    secret_key = models.TextField(null=True, blank=True)
    api_key = models.TextField(null=True, blank=True)
    merchant_id = models.CharField(max_length=200, null=True, blank=True)
    wallet_address = models.CharField(max_length=200, null=True, blank=True)
    network = models.CharField(max_length=50, null=True, blank=True)
    is_test_mode = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    currency = models.CharField(max_length=10, default='USD')
    total_volume = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    tx_count = models.IntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payment_gateways'
        ordering = ['-added_at']


class SeoSettings(models.Model):
    site_title = models.CharField(max_length=200, default='Prnhbbbb')
    site_description = models.TextField(default='Video streaming ve sosyal platform')
    keywords = models.TextField(default='video, streaming, creator, sosyal')
    robots = models.CharField(max_length=100, default='index,follow')
    og_image = models.TextField(default='')
    og_title = models.CharField(max_length=200, default='')
    og_description = models.TextField(default='')
    og_type = models.CharField(max_length=30, default='website')
    twitter_card = models.CharField(max_length=30, default='summary_large_image')
    twitter_site = models.CharField(max_length=100, default='')
    twitter_creator = models.CharField(max_length=100, default='')
    canonical_url = models.TextField(default='')
    google_analytics_id = models.CharField(max_length=50, default='')
    google_search_console = models.CharField(max_length=200, default='')
    bing_verification = models.CharField(max_length=200, default='')
    yandex_verification = models.CharField(max_length=200, default='')
    structured_data_enabled = models.BooleanField(default=True)
    sitemap_enabled = models.BooleanField(default=True)
    hreflang = models.CharField(max_length=10, default='tr')
    schema_org_type = models.CharField(max_length=50, default='Organization')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'seo_settings'


# ─── Legacy single-row webhook settings (kept for migration compat) ────────────
class WebhookSettings(models.Model):
    is_enabled = models.BooleanField(default=False)
    endpoint_url = models.TextField(default='')
    secret = models.TextField(default='')
    events = models.JSONField(default=list)
    endpoints = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'webhook_settings'


# ─── Modern webhook system ──────────────────────────────────────────────────────
class WebhookEndpoint(models.Model):
    PLATFORM_CHOICES = [
        ('discord',   'Discord'),
        ('slack',     'Slack'),
        ('zapier',    'Zapier'),
        ('make',      'Make (Integromat)'),
        ('n8n',       'n8n'),
        ('ifttt',     'IFTTT'),
        ('pipedream', 'Pipedream'),
        ('teams',     'Microsoft Teams'),
        ('telegram',  'Telegram Bot'),
        ('custom',    'Custom HTTP'),
    ]
    STATUS_CHOICES = [
        ('active',    'Active'),
        ('paused',    'Paused'),
        ('failing',   'Failing'),
        ('unknown',   'Unknown'),
    ]

    name          = models.CharField(max_length=200)
    platform      = models.CharField(max_length=30, choices=PLATFORM_CHOICES, default='custom')
    url           = models.TextField()
    secret        = models.CharField(max_length=500, blank=True, default='')
    events        = models.JSONField(default=list)   # list of event strings
    is_enabled    = models.BooleanField(default=True)
    status        = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unknown')
    # Stats (denormalized for speed)
    total_deliveries    = models.IntegerField(default=0)
    success_deliveries  = models.IntegerField(default=0)
    last_triggered_at   = models.DateTimeField(null=True, blank=True)
    last_status_code    = models.IntegerField(null=True, blank=True)
    # Retry config
    max_retries   = models.IntegerField(default=3)
    timeout_secs  = models.IntegerField(default=10)
    # Metadata
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table    = 'webhook_endpoints'
        ordering    = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.platform})'

    @property
    def success_rate(self):
        if self.total_deliveries == 0:
            return None
        return round(self.success_deliveries / self.total_deliveries * 100, 1)


class WebhookDelivery(models.Model):
    STATUS_CHOICES = [
        ('pending',   'Pending'),
        ('success',   'Success'),
        ('failed',    'Failed'),
        ('retrying',  'Retrying'),
    ]

    endpoint        = models.ForeignKey(WebhookEndpoint, on_delete=models.CASCADE, related_name='deliveries')
    event           = models.CharField(max_length=100)
    payload         = models.JSONField(default=dict)      # original event payload
    request_body    = models.TextField(blank=True)        # actual body sent (formatted for platform)
    request_headers = models.JSONField(default=dict)
    response_status = models.IntegerField(null=True, blank=True)
    response_body   = models.TextField(blank=True)
    response_time_ms= models.IntegerField(null=True, blank=True)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    attempt         = models.IntegerField(default=1)
    max_attempts    = models.IntegerField(default=3)
    error           = models.TextField(blank=True)
    triggered_at    = models.DateTimeField(auto_now_add=True)
    delivered_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'webhook_deliveries'
        ordering = ['-triggered_at']
        indexes  = [
            models.Index(fields=['endpoint', '-triggered_at']),
            models.Index(fields=['event', '-triggered_at']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f'{self.event} → {self.endpoint.name} [{self.status}]'


class HomeFilter(models.Model):
    TYPE_CHOICES = [
        ('category', 'Kategori'),
        ('sort',     'Sıralama'),
        ('custom',   'Özel Kural'),
    ]
    SORT_CHOICES = [
        ('most_viewed', 'En Çok İzlenen'),
        ('most_liked',  'En Çok Beğenilen'),
        ('newest',      'En Yeni'),
        ('trending',    'Trend'),
    ]
    label       = models.CharField(max_length=100)
    icon        = models.CharField(max_length=10, default='🎬')
    type        = models.CharField(max_length=20, choices=TYPE_CHOICES, default='sort')
    category_id = models.IntegerField(null=True, blank=True)
    sort_by     = models.CharField(max_length=30, choices=SORT_CHOICES, null=True, blank=True)
    # Kurallar: {"min_views": 0, "min_likes": 0, "is_premium": null, "video_type": null}
    rules       = models.JSONField(default=dict, blank=True)
    order       = models.IntegerField(default=0)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'home_filters'
        ordering = ['order', 'id']

    def __str__(self):
        return self.label


class EmailCampaign(models.Model):
    STATUS_CHOICES = [('draft', 'Draft'), ('scheduled', 'Scheduled'), ('sent', 'Sent')]

    name = models.CharField(max_length=200)
    template_id = models.CharField(max_length=50, default='custom')
    subject = models.CharField(max_length=300, default='')
    body = models.TextField(default='')
    audience = models.CharField(max_length=50, default='all')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    opens = models.IntegerField(default=0)
    clicks = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'email_campaigns'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} [{self.status}]'
