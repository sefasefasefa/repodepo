from django.db import models


class FeatureFlag(models.Model):
    STATE_CHOICES = [
        ('enabled', 'Enabled'), ('disabled', 'Disabled'), ('maintenance', 'Maintenance')
    ]

    key = models.CharField(max_length=100, primary_key=True)
    state = models.CharField(max_length=20, choices=STATE_CHOICES, default='enabled')
    label = models.CharField(max_length=200)
    description = models.TextField(default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'feature_flags'

    def __str__(self):
        return f'{self.key} ({self.state})'


class AbTest(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'), ('active', 'Active'),
        ('paused', 'Paused'), ('ended', 'Ended'),
    ]

    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ab_tests'


class AbTestVariant(models.Model):
    test = models.ForeignKey(AbTest, on_delete=models.CASCADE, related_name='variants')
    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    weight = models.IntegerField(default=50)
    view_count = models.IntegerField(default=0)
    conversion_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ab_test_variants'


class GeoRestrictionSettings(models.Model):
    MODE_CHOICES = [('allowlist', 'Allowlist'), ('blocklist', 'Blocklist')]

    is_enabled = models.BooleanField(default=False)
    mode = models.CharField(max_length=20, choices=MODE_CHOICES, default='blocklist')
    countries = models.JSONField(default=list)
    redirect_url = models.TextField(null=True, blank=True)
    message = models.TextField(default='Bu içerik bulunduğunuz ülkede kullanılamaz.')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'geo_restriction_settings'


class ApiEndpoint(models.Model):
    METHOD_CHOICES = [('GET', 'GET'), ('POST', 'POST'), ('PUT', 'PUT'), ('PATCH', 'PATCH'), ('DELETE', 'DELETE')]

    path = models.CharField(max_length=300)
    method = models.CharField(max_length=10, choices=METHOD_CHOICES)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    requires_auth = models.BooleanField(default=True)
    rate_limit = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'api_endpoints'
        unique_together = ('path', 'method')


class AbTestAssignment(models.Model):
    test = models.ForeignKey(AbTest, on_delete=models.CASCADE, related_name='assignments')
    variant = models.ForeignKey(AbTestVariant, on_delete=models.CASCADE)
    session_id = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ab_test_assignments'
        unique_together = ('test', 'session_id')
