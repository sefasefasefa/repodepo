"""
Sitemap bildirimi.
- Yandex: ping API üzerinden otomatik
- Bing: ping API kapatıldı (HTTP 410), Webmaster Tools üzerinden manuel yapılmalı
Admin panelinden tetiklenebilir: POST /api/seo/ping-sitemap
"""
import requests
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


def _is_admin(user):
    return user.is_authenticated and getattr(user, 'role', '') in ('admin', 'moderator')


def _get_sitemap_url() -> str:
    base = getattr(settings, 'SITE_URL', '').rstrip('/')
    return f'{base}/sitemap.xml'


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ping_sitemap(request):
    """Yandex'e sitemap ping gönderir. Bing için Webmaster Tools linki döner."""
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)

    sitemap_url = _get_sitemap_url()
    results = {}

    # Bing ping API'si 2023'te kapatıldı (HTTP 410) — Webmaster Tools üzerinden yapılmalı
    results['bing'] = {
        'success': None,
        'status': None,
        'message': 'Bing ping API kapatıldı. Sitemap\'i Bing Webmaster Tools\'dan manuel ekle.',
        'action_url': f'https://www.bing.com/webmasters/sitemaps?siteUrl=https://hotpulse.me',
        'manual': True,
    }

    # Yandex ping
    yandex_url = f'https://webmaster.yandex.com/ping?sitemap={sitemap_url}'
    try:
        resp = requests.get(yandex_url, timeout=10)
        success = resp.status_code in (200, 201, 202)
        results['yandex'] = {
            'success': success,
            'status': resp.status_code,
            'message': 'Ping gönderildi' if success else f'Hata: HTTP {resp.status_code}',
            'manual': False,
        }
    except Exception as e:
        results['yandex'] = {
            'success': False,
            'status': None,
            'message': f'Bağlantı hatası: {str(e)}',
            'manual': False,
        }

    cache.set('seo_last_ping', {
        'timestamp': timezone.now().isoformat(),
        'sitemap_url': sitemap_url,
        'results': results,
    }, timeout=86400)

    return Response({
        'sitemapUrl': sitemap_url,
        'results': results,
        'allSuccess': results['yandex'].get('success', False),
    }, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ping_status(request):
    """Son ping bilgisini döner."""
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    data = cache.get('seo_last_ping')
    return Response({'lastPing': data})
