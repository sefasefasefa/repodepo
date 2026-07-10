from django.urls import path
from . import views
from . import visitor_views
from . import seo_ping_views

urlpatterns = [
    path('init', views.app_init),
    path('features', views.list_features),
    path('features/<str:key>', views.update_feature),
    path('recommendations', views.recommendations),
    # Visitor tracking + admin live-map
    path('track', visitor_views.track_visitor),
    path('admin/visitors', visitor_views.admin_visitors),
    path('admin/visitors/chart', visitor_views.admin_visitors_chart),
    # Geo restriction
    path('geo/check', visitor_views.geo_check),
    path('geo/admin/settings', visitor_views.geo_admin_settings),
    # SEO: Bing/Yandex sitemap ping
    path('seo/ping-sitemap', seo_ping_views.ping_sitemap),
    path('seo/ping-status', seo_ping_views.ping_status),
]
