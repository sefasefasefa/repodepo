from django.urls import path
from . import views
from . import seo_webhook_views as sw
from . import webhook_views as wh
from . import moderation_views as mod
from . import developer_views as dev
from . import abtests_views as abt
from . import extra_views as ex
from . import payments_views as pay
from . import watch_insights_views as wi
from . import video_analytics_views as va

urlpatterns = [
    path('admin/watch-insights', wi.watch_insights),
    path('admin/video-analytics', va.video_analytics),
    path('admin/analytics/video-trends', va.video_trends),
    path('analytics/platform', views.platform_analytics),
    path('analytics/creator/<int:user_id>', views.creator_analytics),
    path('admin/reports', views.list_reports),
    path('admin/reports/<int:report_id>/resolve', views.resolve_report),
    path('admin/users', views.list_admin_users),
    path('admin/users/<int:user_id>/ban', views.ban_user),
    path('admin/users/<int:user_id>/unban', ex.unban_user),
    path('admin/users/<int:user_id>/role', views.update_user_role),
    path('admin/users/<int:user_id>/edit', views.edit_user),
    path('admin/dashboard', ex.admin_dashboard),
    path('admin/reports/<int:report_id>', ex.update_report),
    path('admin/videos', views.list_admin_videos),
    path('admin/videos/<int:video_id>', views.delete_video_admin),
    # Video moderation workflow
    path('admin/moderation/queue', mod.moderation_queue),
    path('admin/moderation/stats', mod.moderation_stats),
    path('admin/moderation/<int:video_id>/approve', mod.moderation_approve),
    path('admin/moderation/<int:video_id>/reject', mod.moderation_reject),
    path('admin/moderation/<int:video_id>/flag', mod.moderation_flag),
    path('admin/watermark', views.manage_watermark),
    path('admin/geo', views.list_geo_settings),
    path('admin/geo/update', views.update_geo_settings),
    path('admin/subscriptions/plans', views.manage_subscription_plans),
    path('admin/withdrawals', views.list_withdrawal_requests),
    path('admin/withdrawals/<int:wr_id>/process', views.process_withdrawal),
    path('admin/creator-applications', views.list_creator_applications),
    path('admin/creator-applications/<int:app_id>/process', views.process_creator_application),
    path('site-config', views.public_site_config),
    path('admin/settings', views.get_site_settings),
    path('admin/settings/update', views.update_site_settings),
    path('admin/ads', views.manage_ads),
    path('admin/ads/<int:ad_id>', views.delete_ad),
    path('admin/badges', views.manage_badges),
    path('admin/badges/award/<int:user_id>', views.award_badge),
    # SEO / Watermark admin settings
    path('seo/admin/settings', sw.seo_settings),
    path('seo/public/settings', sw.public_seo_settings),
    path('watermark/admin/settings', sw.watermark_admin_settings),
    path('watermark/admin/upload', sw.watermark_upload),
    # Legacy webhook settings (kept for compat)
    path('webhooks/admin/settings', sw.webhook_settings),
    # Modern webhook management
    path('webhooks/admin/global', wh.global_toggle),
    path('webhooks/admin/stats', wh.webhook_stats),
    path('webhooks/admin/fire', wh.manual_fire),
    path('webhooks/admin/endpoints', wh.endpoint_list),
    path('webhooks/admin/endpoints/<int:ep_id>', wh.endpoint_detail),
    path('webhooks/admin/endpoints/<int:ep_id>/toggle', wh.endpoint_toggle),
    path('webhooks/admin/endpoints/<int:ep_id>/test', wh.endpoint_test),
    path('webhooks/admin/deliveries', wh.delivery_list),
    path('webhooks/admin/deliveries/<int:delivery_id>', wh.delivery_detail),
    path('webhooks/admin/deliveries/<int:delivery_id>/retry', wh.delivery_retry),
    path('admin/pages', views.list_custom_pages),
    path('admin/pages/create', views.create_custom_page),
    # Public pages + admin CRUD (Express /api/pages parity)
    path('pages', ex.pages),
    path('pages/<int:page_id>', ex.page_detail),
    # Payment gateways
    path('payments/gateways', pay.active_gateways),
    path('admin/payments/gateways', pay.gateways),
    path('admin/payments/gateways/<int:gw_id>', pay.gateway_delete),
    path('admin/payments/gateways/<int:gw_id>/set-default', pay.gateway_set_default),
    path('admin/payments/gateways/<int:gw_id>/toggle', pay.gateway_toggle),
    path('admin/payments/gateways/<int:gw_id>/test', pay.gateway_test),
    path('admin/payments/transactions', pay.transactions),
    # Developer page: API endpoints
    path('admin/api-endpoints', dev.api_endpoints),
    path('admin/api-endpoints/<int:ep_id>', dev.api_endpoint_detail),
    path('admin/api-endpoints/<int:ep_id>/toggle', dev.api_endpoint_toggle),
    path('admin/api-endpoints/<int:ep_id>/test', dev.api_endpoint_test),
    # Developer page: API clients
    path('admin/api-clients', dev.api_clients),
    path('admin/api-clients/<int:client_id>/toggle', dev.api_client_toggle),
    path('docs', dev.api_docs),
    # Admin: CDN management
    path('admin/cdn', dev.admin_cdn),
    path('admin/cdn/<int:cdn_id>', dev.admin_cdn_delete),
    path('admin/cdn/<int:cdn_id>/default', dev.admin_cdn_set_default),
    path('admin/cdn/<int:cdn_id>/test', dev.admin_cdn_test),
    # Admin: Integrations (Streamtape/Doodstream/Mixdrop) + billing
    path('admin/integrations', dev.admin_integrations),
    path('admin/integrations/billing', dev.admin_integration_billing),
    path('admin/integrations/<int:integration_id>', dev.admin_integration_detail),
    path('admin/integrations/<int:integration_id>/test', dev.admin_integration_test),
    # Admin: Revenue projection
    path('admin/revenue/projection', dev.admin_revenue_projection),
    # Admin: security stats
    path('admin/security/stats', dev.admin_security_stats),
    path('admin/security/access-logs', dev.admin_security_access_logs),
    path('admin/security/blocked-ips', dev.admin_security_blocked_ips),
    path('admin/security/blocked-ips/<str:ip>', dev.admin_security_unblock_ip),
    # A/B testing
    path('ab-tests/<str:test_name>/assign', abt.assign),
    path('ab-tests/<str:test_name>/convert', abt.convert),
    path('admin/ab-tests', abt.admin_tests),
    path('admin/ab-tests/<int:test_id>', abt.admin_test_detail),
    path('admin/ab-tests/<int:test_id>/variants', abt.admin_add_variant),
    path('admin/ab-tests/<int:test_id>/variants/<int:variant_id>', abt.admin_delete_variant),
    path('admin/ab-tests/<int:test_id>/reset', abt.admin_reset),
    path('admin/email-campaigns', ex.email_campaigns),
    path('admin/email-campaigns/<int:campaign_id>', ex.email_campaign_detail),
    # Home filters
    path('home-filters', ex.public_home_filters),
    path('admin/home-filters', ex.admin_home_filters),
    path('admin/home-filters/<int:filter_id>', ex.admin_home_filter_detail),
]
