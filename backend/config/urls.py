import os
import re
import mimetypes

# HLS dosya türleri için MIME tipi kaydı
mimetypes.add_type("application/vnd.apple.mpegurl", ".m3u8")
mimetypes.add_type("video/mp2t", ".ts")

from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from rest_framework_simplejwt.views import TokenRefreshView, TokenObtainPairView

from apps.core.sitemap import sitemap_xml, robots_txt
from apps.core.seo_views import video_seo_page, global_seo_page
from django.http import JsonResponse, HttpResponse


def jwks_directory(request):
    """
    Web Bot Auth — JWKS directory endpoint.
    Draft: https://datatracker.ietf.org/wg/webbotauth/about/
    Cloudflare: https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth/

    Sitenin bot/agent isteklerini imzalarken kullandığı Ed25519 public key'i JWKS formatında yayınlar.
    Alıcı siteler bu endpoint'i fetch ederek imzayı doğrulayabilir.
    """
    import base64, os, time

    pub_b64 = os.environ.get("BOT_SIGNING_PUBLIC_KEY", "")
    kid     = os.environ.get("BOT_SIGNING_KID", "hotpulse-bot-2026-01")

    if not pub_b64:
        return JsonResponse({"error": "signing key not configured"}, status=503)

    # Ed25519 public key → JWK (RFC 8037)
    jwk = {
        "kty": "OKP",
        "crv": "Ed25519",
        "kid": kid,
        "use": "sig",
        "alg": "EdDSA",
        "x": pub_b64,   # raw public key, base64url-encoded (no padding)
    }

    base = request.build_absolute_uri("/").rstrip("/")
    payload = {
        "keys": [jwk],
        # Web Bot Auth metadata
        "iss": base,
        "iat": int(time.time()),
        "context": {
            "site": base,
            "contact": f"{base}/about",
            "purpose": "Hotpulse platform agent requests signed with this key for identity verification.",
        },
    }

    response = JsonResponse(payload)
    response["Access-Control-Allow-Origin"] = "*"
    response["Cache-Control"] = "public, max-age=3600"
    return response


def api_catalog(request):
    """
    RFC 9727 — API Catalog (application/linkset+json).
    RFC 9264 — Linkset format.
    """
    import json
    base = request.build_absolute_uri('/').rstrip('/')

    # RFC 9264 linkset+json: her API için anchor + ilişkili linkler
    linkset = [
        {
            "anchor": f"{base}/api/",
            "service-desc": [
                {"href": f"{base}/api/healthz", "type": "application/json"}
            ],
            "service-doc": [
                {"href": f"{base}/docs/", "type": "text/html"}
            ],
            "status": [
                {"href": f"{base}/api/healthz"}
            ],
        },
        {
            "anchor": f"{base}/api/videos/",
            "service-desc": [{"href": f"{base}/api/videos/", "type": "application/json"}],
            "type": [{"href": "https://schema.org/VideoObject"}],
        },
        {
            "anchor": f"{base}/api/token/",
            "service-desc": [{"href": f"{base}/api/token/", "type": "application/json"}],
            "type": [{"href": "https://www.iana.org/assignments/media-types/application/json"}],
        },
        {
            "anchor": f"{base}/.well-known/api-catalog",
            "self": [{"href": f"{base}/.well-known/api-catalog"}],
            "type": [{"href": "https://www.rfc-editor.org/rfc/rfc9727"}],
        },
    ]

    body = json.dumps({"linkset": linkset}, ensure_ascii=False, indent=2)
    response = HttpResponse(body, content_type="application/linkset+json")
    response["Access-Control-Allow-Origin"] = "*"
    response["Link"] = f'<{base}/.well-known/api-catalog>; rel="self"; type="application/linkset+json"'
    response["Cache-Control"] = "public, max-age=3600"
    return response


urlpatterns = [
    path('django-admin/', admin.site.urls),

    # Agent discovery (RFC 8288 / RFC 9727)
    path('.well-known/api-catalog', api_catalog, name='api_catalog'),

    # Web Bot Auth — JWKS directory (Ed25519 public key)
    path('.well-known/http-message-signatures-directory', jwks_directory, name='jwks_directory'),

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

            chunk_size = 524288  # 512 KB

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
            resp['Cache-Control'] = 'public, max-age=3600'
            resp['Access-Control-Allow-Origin'] = '*'
            resp['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
            resp['Access-Control-Allow-Headers'] = 'Range, Content-Type'
            resp['Access-Control-Expose-Headers'] = 'Content-Range, Accept-Ranges, Content-Length'
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
    resp['Cache-Control'] = 'public, max-age=3600'
    resp['Access-Control-Allow-Origin'] = '*'
    resp['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
    resp['Access-Control-Allow-Headers'] = 'Range, Content-Type'
    resp['Access-Control-Expose-Headers'] = 'Content-Range, Accept-Ranges, Content-Length'
    return resp

urlpatterns += [re_path(r'^media/(?P<path>.*)$', _serve_media)]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# SPA catch-all: serve React index.html for all non-API, non-admin, non-static paths.
# This must come LAST so it doesn't shadow API or admin routes.
from django.http import FileResponse, HttpResponse, Http404


def _serve_from_static(request, path):
    """Serve files referenced at root (e.g. /assets/*, /favicon.svg, /mining-worker.js).
    WhiteNoise (WHITENOISE_ROOT) normally handles these before URL routing runs —
    this view is a fallback only. Adds long-lived cache headers for hashed assets."""
    import gzip as _gzip

    accept_enc = request.META.get('HTTP_ACCEPT_ENCODING', '')
    want_gzip = 'gzip' in accept_enc

    candidates = list(settings.STATICFILES_DIRS) + [settings.STATIC_ROOT]
    for root in candidates:
        root = str(root)
        full = os.path.normpath(os.path.join(root, path))
        if not full.startswith(root):
            continue
        if not os.path.exists(full) or not os.path.isfile(full):
            continue

        content_type, _ = mimetypes.guess_type(full)
        content_type = content_type or 'application/octet-stream'

        # Content-hash'li dosyalar (e.g. index-CJg2NGgO.js) → 1 yıl cache
        import re as _re
        is_hashed = bool(_re.search(r'-[A-Za-z0-9_]{8,}\.(js|css|woff2?|png|svg|jpg)$', path))
        cache_ctrl = 'public, max-age=31536000, immutable' if is_hashed else 'public, max-age=3600'

        # Gzip varsa sun
        gz_path = full + '.gz'
        if want_gzip and os.path.exists(gz_path):
            resp = FileResponse(open(gz_path, 'rb'), content_type=content_type)
            resp['Content-Encoding'] = 'gzip'
            resp['Vary'] = 'Accept-Encoding'
            resp['Cache-Control'] = cache_ctrl
            return resp

        resp = FileResponse(open(full, 'rb'), content_type=content_type)
        resp['Cache-Control'] = cache_ctrl
        return resp
    raise Http404


_LINK_HEADER = (
    '</.well-known/api-catalog>; rel="api-catalog", '
    '</api/healthz>; rel="service-desc", '
    '</sitemap.xml>; rel="sitemap"'
)

def spa_index(request, *args, **kwargs):
    index_path = os.path.join(settings.STATICFILES_DIRS[0] if settings.STATICFILES_DIRS else settings.STATIC_ROOT, 'index.html')
    if os.path.exists(index_path):
        resp = FileResponse(open(index_path, 'rb'), content_type='text/html')
        resp["Link"] = _LINK_HEADER
        return resp
    resp = HttpResponse(
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
    resp["Link"] = _LINK_HEADER
    return resp


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
