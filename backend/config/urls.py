from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from rest_framework_simplejwt.views import TokenRefreshView, TokenObtainPairView

from apps.core.sitemap import sitemap_xml, robots_txt
from apps.core.seo_views import video_seo_page

urlpatterns = [
    path('django-admin/', admin.site.urls),

    # SEO
    path('sitemap.xml', sitemap_xml, name='sitemap'),
    path('robots.txt', robots_txt, name='robots_txt'),

    # JWT token endpoints
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # App API routes
    path('api/', include('apps.accounts.urls')),
    path('api/', include('apps.videos.urls')),
    path('api/', include('apps.social.urls')),
    path('api/', include('apps.subscriptions.urls')),
    path('api/', include('apps.notifications.urls')),
    path('api/', include('apps.live.urls')),
    path('api/', include('apps.messaging.urls')),
    path('api/', include('apps.tokens.urls')),
    path('api/', include('apps.affiliate.urls')),
    path('api/', include('apps.admin_panel.urls')),
    path('api/', include('apps.crosspost.urls')),
    path('api/', include('apps.ai.urls')),
    path('api/', include('apps.devices.urls')),
    path('api/', include('apps.core.urls')),
    path('api/healthz', include('apps.core.health_urls')),
]

def _serve_media(request, path):
    """Serve media files with graceful 404 (no Django debug page)."""
    import mimetypes
    full = os.path.normpath(os.path.join(settings.MEDIA_ROOT, path))
    if not str(full).startswith(str(settings.MEDIA_ROOT)):
        from django.http import JsonResponse
        return JsonResponse({'error': 'Forbidden'}, status=403)
    if not os.path.exists(full) or not os.path.isfile(full):
        from django.http import JsonResponse
        return JsonResponse({'error': 'Medya dosyası bulunamadı', 'path': path}, status=404)
    content_type, _ = mimetypes.guess_type(full)
    return FileResponse(open(full, 'rb'), content_type=content_type or 'application/octet-stream')

urlpatterns += [re_path(r'^media/(?P<path>.*)$', _serve_media)]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# SPA catch-all: serve React index.html for all non-API, non-admin, non-static paths.
# This must come LAST so it doesn't shadow API or admin routes.
import os
import mimetypes
from django.http import FileResponse, HttpResponse, Http404


def _serve_from_static(request, path):
    """Serve files referenced at root (e.g. /assets/*, /favicon.svg, /mining-worker.js).
    Checks STATICFILES_DIRS first (original Vite build filenames), then STATIC_ROOT."""
    candidates = list(settings.STATICFILES_DIRS) + [settings.STATIC_ROOT]
    for root in candidates:
        root = str(root)
        full = os.path.normpath(os.path.join(root, path))
        if not full.startswith(root):
            continue
        if os.path.exists(full) and os.path.isfile(full):
            content_type, _ = mimetypes.guess_type(full)
            return FileResponse(open(full, 'rb'), content_type=content_type or 'application/octet-stream')
    raise Http404


def spa_index(request, *args, **kwargs):
    index_path = os.path.join(settings.STATICFILES_DIRS[0] if settings.STATICFILES_DIRS else settings.STATIC_ROOT, 'index.html')
    if os.path.exists(index_path):
        return FileResponse(open(index_path, 'rb'), content_type='text/html')
    return HttpResponse(
        '<!DOCTYPE html><html><body>'
        '<h2>Soci API is running ✓</h2>'
        '<p>React frontend not built yet. Run <code>npm run build</code> in the '
        'frontend directory and copy <code>dist/</code> contents to '
        '<code>staticfiles/</code>.</p>'
        '<p>API base: <a href="/api/healthz">/api/healthz</a></p>'
        '</body></html>',
        content_type='text/html',
        status=200,
    )


urlpatterns += [
    re_path(r'^(?P<path>assets/.+)$', _serve_from_static),
    re_path(r'^(?P<path>favicon\.[a-zA-Z0-9]+)$', _serve_from_static),
    re_path(r'^(?P<path>mining-worker\.js)$', _serve_from_static),
    re_path(r'^(?P<path>opengraph\.[a-zA-Z]+)$', _serve_from_static),
    # Video sayfaları — server-side OG meta + JSON-LD enjeksiyonu
    re_path(r'^videos/(?P<slug>[\w.-]+)$', video_seo_page),
    # SPA catch-all — diğer tüm URL'ler
    re_path(r'^(?!api/|django-admin/|static/|media/|assets/).*$', spa_index),
]
