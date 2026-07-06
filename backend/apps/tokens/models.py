from django.db import models
from django.conf import settings


class TokenPackage(models.Model):
    name = models.CharField(max_length=200)
    tokens = models.IntegerField()
    price_usd = models.DecimalField(max_digits=10, decimal_places=2)
    bonus = models.IntegerField(default=0)
    is_popular = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'token_packages'

    def __str__(self):
        return f'{self.name} ({self.tokens} tokens)'


class TokenTransaction(models.Model):
    TYPE_CHOICES = [
        ('purchase', 'Purchase'), ('tip', 'Tip'), ('receive', 'Receive'),
        ('commission', 'Commission'), ('withdrawal', 'Withdrawal'), ('refund', 'Refund'),
        ('integration', 'Integration Charge'),
    ]
    STATUS_CHOICES = [('completed', 'Completed'), ('pending', 'Pending'), ('failed', 'Failed')]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='token_transactions')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount = models.IntegerField()
    usd_value = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    related_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='related_token_transactions'
    )
    video_id = models.IntegerField(null=True, blank=True)
    description = models.TextField(default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'token_transactions'
        ordering = ['-created_at']


class WithdrawalRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'), ('approved', 'Approved'),
        ('rejected', 'Rejected'), ('paid', 'Paid'),
    ]
    METHOD_CHOICES = [('bank', 'Bank'), ('crypto', 'Crypto'), ('paypal', 'PayPal')]

    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='withdrawal_requests')
    token_amount = models.IntegerField()
    usd_amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default='bank')
    details = models.TextField(default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_note = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'withdrawal_requests'
