from django.db import models
from django.conf import settings


class AffiliateSettings(models.Model):
    is_active = models.BooleanField(default=False)
    commission_rate = models.DecimalField(max_digits=5, decimal_places=4, default=0.10)
    sub_commission_rate = models.DecimalField(max_digits=5, decimal_places=4, default=0.05)
    cookie_days = models.IntegerField(default=30)
    min_payout_usd = models.DecimalField(max_digits=10, decimal_places=2, default=10.00)
    allowed_events = models.CharField(max_length=200, default='register,subscribe,purchase')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'affiliate_settings'


class AffiliateLink(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='affiliate_links')
    code = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)
    total_clicks = models.IntegerField(default=0)
    total_conversions = models.IntegerField(default=0)
    total_earned_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'affiliate_links'


class AffiliateClick(models.Model):
    link = models.ForeignKey(AffiliateLink, on_delete=models.CASCADE, related_name='clicks')
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    converted_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    converted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'affiliate_clicks'


class AffiliateCommission(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('paid', 'Paid'), ('cancelled', 'Cancelled')]

    affiliate_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='commissions_earned'
    )
    referred_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='commissions_generated'
    )
    event = models.CharField(max_length=50)
    amount_usd = models.DecimalField(max_digits=10, decimal_places=4)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'affiliate_commissions'


class AffiliatePayout(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('paid', 'Paid')]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='affiliate_payouts')
    amount_usd = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, default='bank')
    details = models.TextField(default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_note = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'affiliate_payouts'
