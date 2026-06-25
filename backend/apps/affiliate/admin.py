from django.contrib import admin
from .models import AffiliateSettings, AffiliateLink, AffiliateClick, AffiliateCommission, AffiliatePayout


@admin.register(AffiliateLink)
class AffiliateLinkAdmin(admin.ModelAdmin):
    list_display = ('user', 'code', 'is_active', 'total_clicks', 'total_conversions')


@admin.register(AffiliateCommission)
class AffiliateCommissionAdmin(admin.ModelAdmin):
    list_display = ('affiliate_user', 'event', 'amount_usd', 'status')
    list_filter = ('status',)


@admin.register(AffiliatePayout)
class AffiliatePayoutAdmin(admin.ModelAdmin):
    list_display = ('user', 'amount_usd', 'method', 'status')
    list_filter = ('status',)


admin.site.register(AffiliateSettings)
admin.site.register(AffiliateClick)
