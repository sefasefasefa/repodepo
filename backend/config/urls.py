import os
import re
import mimetypes
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from rest_framework_simplejwt.views import TokenRefreshView, TokenObtainPairView

from apps.core.sitemap import sitemap_xml, robots_txt
from apps.core.seo_views import video_seo_page, global_seo_page

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
    """
    Serve media files with full HTTP Range request support.
    Range desteği olmadan büyük video dosyaları seek yapılamaz ve
    bir süre sonra oynatma durur. Bu fonksiyon 206 Partial Content
    döndürerek seek ve progressive buffering'i destekler.
    """
    import mimetypes
    from django.http import StreamingHttpResponse, JsonResponse, HttpResponse

    media_root = str(settings.MEDIA_ROOT)
    full = os.path.normpath(os.path.join(media_root, path))

    if not full.startswith(media_root):
        return JsonResponse({'error': 'Forbidden'}, status=403)
    if not os.path.exists(full) or not os.path.isfile(full):
        return JsonResponse({'error': 'Medya dosyası bulunamadı', 'path': path}, status=404)

    content_type, _ = mimetypes.guess_type(full)
    content_type = content_type or 'application/octet-stream'
    file_size = os.path.getsize(full)

    range_header = request.META.get('HTTP_RANGE', '').strip()

    if range_header:
        # Parse Range: bytes=start-end
        try:
            range_match = re.match(r'bytes=(\d*)-(\d*)', range_header)
            if not range_match:
                resp = HttpResponse(status=416)
                resp['Content-Range'] = f'bytes */{file_size}'
                return resp

            range_start_str, range_end_str = range_match.group(1), range_match.group(2)
            range_start = int(range_start_str) if range_start_str else 0
            range_end = int(range_end_str) if range_end_str else file_size - 1

            if range_end >= file_size:
                range_end = file_size - 1
            if range_start > range_end:
                resp = HttpResponse(status=416)
                resp['Content-Range'] = f'bytes */{file_size}'
                return resp

            chunk_size = 65536  # 64 KB

            def file_iterator(filepath, start, end):
                with open(filepath, 'rb') as f:
                    f.seek(start)
                    remaining = end - start + 1
                    while remaining > 0:
                        data = f.read(min(chunk_size, remaining))
                        if not data:
                            break
                        remaining -= len(data)
                        yield data

            content_length = range_end - range_start + 1
            resp = StreamingHttpResponse(
                file_iterator(full, range_start, range_end),
                status=206,
                content_type=content_type,
            )
            resp['Content-Length'] = content_length
            resp['Content-Range'] = f'bytes {range_start}-{range_end}/{file_size}'
            resp['Accept-Ranges'] = 'bytes'
            resp['Cache-Control'] = 'no-cache'
            return resp

        except Exception:
            pass

    # Range header yoksa dosyanın tamamını dön (ama Accept-Ranges bildir)
    def full_file_iterator(filepath):
        with open(filepath, 'rb') as f:
            while True:
                data = f.read(65536)
                if not data:
                    break
                yield data

    resp = StreamingHttpResponse(
        full_file_iterator(full),
        content_type=content_type,
    )
    resp['Content-Length'] = file_size
    resp['Accept-Ranges'] = 'bytes'
    resp['Cache-Control'] = 'no-cache'
    return resp

urlpatterns += [re_path(r'^media/(?P<path>.*)$', _serve_media)]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# SPA catch-all: serve React index.html for all non-API, non-admin, non-static paths.
# This must come LAST so it doesn't shadow API or admin routes.
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
    # SPA catch-all — global SEO meta enjeksiyonlu
    re_path(r'^(?!api/|django-admin/|static/|media/|assets/).*$', global_seo_page),
]
