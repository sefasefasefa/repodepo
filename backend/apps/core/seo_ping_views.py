"""
Bing ve Yandex'e sitemap URL'sini otomatik bildirir.
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


PING_ENGINES = {
    'bing': 'https://www.bing.com/ping?sitemap={sitemap_url}',
    'yandex': 'https://webmaster.yandex.com/ping?sitemap={sitemap_url}',
}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ping_sitemap(request):
    """Bing ve Yandex'e sitemap ping gönderir."""
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)

    sitemap_url = _get_sitemap_url()
    results = {}

    for engine, url_template in PING_ENGINES.items():
        ping_url = url_template.format(sitemap_url=sitemap_url)
        try:
            resp = requests.get(ping_url, timeout=10)
            success = resp.status_code in (200, 201, 202)
            results[engine] = {
                'success': success,
                'status': resp.status_code,
                'message': 'Ping gönderildi' if success else f'Hata: HTTP {resp.status_code}',
            }
        except Exception as e:
            results[engine] = {
                'success': False,
                'status': None,
                'message': f'Bağlantı hatası: {str(e)}',
            }

    # Son ping zamanını cache'e kaydet
    cache.set('seo_last_ping', {
        'timestamp': timezone.now().isoformat(),
        'sitemap_url': sitemap_url,
        'results': results,
    }, timeout=86400)

    all_ok = all(r['success'] for r in results.values())
    return Response({
        'sitemapUrl': sitemap_url,
        'results': results,
        'allSuccess': all_ok,
    }, status=200 if all_ok else 207)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ping_status(request):
    """Son ping bilgisini döner."""
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    data = cache.get('seo_last_ping')
    return Response({'lastPing': data})
