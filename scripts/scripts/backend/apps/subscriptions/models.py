from django.db import models
from django.conf import settings


class SubscriptionPlan(models.Model):
    BILLING_CYCLES = [('monthly', 'Monthly'), ('yearly', 'Yearly'), ('lifetime', 'Lifetime')]

    name = models.CharField(max_length=200)
    description = models.TextField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    billing_cycle = models.CharField(max_length=20, choices=BILLING_CYCLES, default='monthly')
    features = models.JSONField(default=list)
    is_popular = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'subscription_plans'

    def __str__(self):
        return f'{self.name} ({self.billing_cycle})'


class UserSubscription(models.Model):
    STATUS_CHOICES = [
        ('active', 'Active'), ('cancelled', 'Cancelled'),
        ('expired', 'Expired'), ('paused', 'Paused'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='subscriptions')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    current_period_start = models.DateTimeField(auto_now_add=True)
    current_period_end = models.DateTimeField()
    cancel_at_period_end = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_subscriptions'


class GiftSubscription(models.Model):
    STATUS_CHOICES = [('active', 'Active'), ('expired', 'Expired'), ('cancelled', 'Cancelled')]

    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_gifts')
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_gifts')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.CASCADE)
    duration_months = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    note = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'gift_subscriptions'
        ordering = ['-created_at']


class Payment(models.Model):
    PAYMENT_TYPES = [
        ('subscription', 'Subscription'), ('tip', 'Tip'), ('ppv', 'PPV'),
        ('token_purchase', 'Token Purchase'), ('withdrawal', 'Withdrawal'),
    ]
    STATUS_CHOICES = [('completed', 'Completed'), ('pending', 'Pending'), ('failed', 'Failed'), ('refunded', 'Refunded')]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payments')
    type = models.CharField(max_length=30, choices=PAYMENT_TYPES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    description = models.TextField()
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='received_payments'
    )
    metadata = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payments'
