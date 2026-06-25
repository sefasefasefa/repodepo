from django.db import models
from django.conf import settings


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


# ─── Developer API config (Express api_endpoints + api_clients) ────────────────
class ApiEndpointConfig(models.Model):
    """Configurable public API endpoint shown on the developer page."""
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


# ─── CDN configurations (admin) ───────────────────────────────────────────────
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


# ─── Third-party integrations (Streamtape/Doodstream/Mixdrop) ─────────────────
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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'integration_configs'
        ordering = ['-created_at']


# A/B test models live in apps.core (AbTest, AbTestVariant, AbTestAssignment).


# ─── Payment gateway configs (admin) ──────────────────────────────────────────
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
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'seo_settings'


class WebhookSettings(models.Model):
    is_enabled = models.BooleanField(default=False)
    endpoint_url = models.TextField(default='')
    secret = models.TextField(default='')
    events = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'webhook_settings'
