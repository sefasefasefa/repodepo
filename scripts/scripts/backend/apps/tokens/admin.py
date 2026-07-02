from django.contrib import admin
from .models import TokenPackage, TokenTransaction, WithdrawalRequest


@admin.register(TokenPackage)
class TokenPackageAdmin(admin.ModelAdmin):
    list_display = ('name', 'tokens', 'price_usd', 'bonus', 'is_active')


@admin.register(TokenTransaction)
class TokenTransactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'type', 'amount', 'status', 'created_at')
    list_filter = ('type', 'status')


@admin.register(WithdrawalRequest)
class WithdrawalRequestAdmin(admin.ModelAdmin):
    list_display = ('creator', 'token_amount', 'usd_amount', 'method', 'status')
    list_filter = ('status', 'method')
