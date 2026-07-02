from django.contrib import admin
from .models import FeatureFlag, AbTest, AbTestVariant, GeoRestrictionSettings, ApiEndpoint


@admin.register(FeatureFlag)
class FeatureFlagAdmin(admin.ModelAdmin):
    list_display = ('key', 'state', 'label', 'updated_at')
    list_filter = ('state',)
    search_fields = ('key', 'label')


@admin.register(AbTest)
class AbTestAdmin(admin.ModelAdmin):
    list_display = ('name', 'status', 'created_at')
    list_filter = ('status',)


@admin.register(AbTestVariant)
class AbTestVariantAdmin(admin.ModelAdmin):
    list_display = ('name', 'test', 'weight', 'view_count', 'conversion_count')


admin.site.register(GeoRestrictionSettings)
admin.site.register(ApiEndpoint)
