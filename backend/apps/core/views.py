from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .models import FeatureFlag, AbTest, AbTestVariant, GeoRestrictionSettings, ApiEndpoint

DEFAULT_FLAGS = [
    # Mesajlaşma
    {'key': 'dm_messages', 'label': 'Direkt Mesajlar', 'description': 'Kullanıcılar arası özel mesajlaşma', 'group': 'Mesajlaşma'},
    {'key': 'voice_messages', 'label': 'Sesli Mesajlar', 'description': 'DM sesli mesaj kaydı', 'group': 'Mesajlaşma'},
    {'key': 'audio_calls', 'label': 'Sesli Aramalar', 'description': 'DM içi sesli arama', 'group': 'Mesajlaşma'},
    {'key': 'video_calls', 'label': 'Görüntülü Aramalar', 'description': 'DM içi görüntülü arama', 'group': 'Mesajlaşma'},
    # Canlı Yayın
    {'key': 'live_streams', 'label': 'Canlı Yayınlar', 'description': 'Canlı yayın izleme ve yayın başlatma', 'group': 'Canlı Yayın'},
    {'key': 'live_chat', 'label': 'Canlı Yayın Sohbeti', 'description': 'Canlı yayınlarda sohbet paneli', 'group': 'Canlı Yayın'},
    # İçerik
    {'key': 'videos', 'label': 'Videolar', 'description': 'Video listeleri ve video sayfaları', 'group': 'İçerik'},
    {'key': 'shorts', 'label': 'Shorts', 'description': 'Kısa video akışı', 'group': 'İçerik'},
    {'key': 'search', 'label': 'Arama', 'description': 'Site içi arama', 'group': 'İçerik'},
    {'key': 'categories', 'label': 'Kategoriler', 'description': 'Kategori sayfaları', 'group': 'İçerik'},
    {'key': 'creators', 'label': 'Creatorlar', 'description': 'Creator listeleri ve profilleri', 'group': 'İçerik'},
    {'key': 'stories', 'label': 'Stories', 'description': 'Hikaye akışı', 'group': 'İçerik'},
    # Hesap
    {'key': 'playlists', 'label': 'Playlistler', 'description': 'Oynatma listeleri', 'group': 'Hesap'},
    {'key': 'notifications', 'label': 'Bildirimler', 'description': 'Bildirim merkezi', 'group': 'Hesap'},
    {'key': 'history', 'label': 'Geçmiş', 'description': 'İzleme geçmişi', 'group': 'Hesap'},
    {'key': 'bookmarks', 'label': 'Kaydedilenler', 'description': 'Kayıtlı içerikler', 'group': 'Hesap'},
    {'key': 'subscriptions', 'label': 'Abonelikler', 'description': 'Abonelik yönetim ekranı', 'group': 'Hesap'},
    {'key': 'pricing', 'label': 'Fiyatlandırma', 'description': 'Üyelik planları sayfası', 'group': 'Hesap'},
    {'key': 'payment', 'label': 'Ödeme', 'description': 'Ödeme ekranı', 'group': 'Hesap'},
    {'key': 'payments', 'label': 'Ödeme Sistemi', 'description': 'Genel ödeme altyapısı', 'group': 'Hesap'},
    {'key': 'downloads', 'label': 'İndirilenler', 'description': 'İndirilenler sayfası', 'group': 'Hesap'},
    # Üretici
    {'key': 'upload', 'label': 'Yükleme', 'description': 'Video yükleme ekranı', 'group': 'Üretici'},
    {'key': 'creator_dashboard', 'label': 'Creator Dashboard', 'description': 'Creator paneli', 'group': 'Üretici'},
    # Topluluk
    {'key': 'leaderboard', 'label': 'Sıralama', 'description': 'Sadakat sıralaması sayfası', 'group': 'Topluluk'},
    {'key': 'match', 'label': 'Eşleşme', 'description': 'Rastgele eşleşme odaları', 'group': 'Topluluk'},
    {'key': 'affiliate', 'label': 'Affiliate', 'description': 'Affiliate sayfası', 'group': 'Topluluk'},
    # Yönetim
    {'key': 'admin_panel', 'label': 'Admin Panel', 'description': 'Admin panel girişi', 'group': 'Yönetim'},
]

DEFAULT_FLAG_MAP = {f['key']: f for f in DEFAULT_FLAGS}
_initialized = False


def ensure_defaults():
    global _initialized
    if _initialized:
        return
    for flag in DEFAULT_FLAGS:
        FeatureFlag.objects.get_or_create(key=flag['key'], defaults={
            'label': flag['label'], 'description': flag['description'], 'state': 'enabled'
        })
    _initialized = True


@api_view(['GET'])
@permission_classes([AllowAny])
def list_features(request):
    cached = cache.get('features:all')
    if cached is not None:
        resp = Response(cached)
        resp['Cache-Control'] = 'public, max-age=120, stale-while-revalidate=60'
        resp['Vary'] = 'Accept-Encoding'
        return resp
    ensure_defaults()
    flags = FeatureFlag.objects.all()
    flag_map = {f.key: f.state for f in flags}
    details = []
    for f in flags:
        defaults = DEFAULT_FLAG_MAP.get(f.key, {})
        details.append({
            'key': f.key, 'state': f.state,
            'label': f.label or defaults.get('label', f.key),
            'description': f.description or defaults.get('description', ''),
            'group': defaults.get('group', 'Diğer'),
        })
    result = {'flags': flag_map, 'details': details}
    cache.set('features:all', result, 120)
    resp = Response(result)
    resp['Cache-Control'] = 'public, max-age=120, stale-while-revalidate=60'
    resp['Vary'] = 'Accept-Encoding'
    return resp


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_feature(request, key):
    if not request.user.is_authenticated or request.user.role != 'admin':
        return Response({'error': 'Admin gerekli'}, status=403)
    state = request.data.get('state')
    if state not in ('enabled', 'disabled', 'maintenance'):
        return Response({'error': 'Geçersiz durum (enabled/disabled/maintenance)'}, status=400)
    defaults = DEFAULT_FLAG_MAP.get(key, {'label': key, 'description': ''})
    # Auto-create when missing so newly defined flags are always toggleable.
    flag, _created = FeatureFlag.objects.get_or_create(key=key, defaults={
        'label': defaults.get('label', key),
        'description': defaults.get('description', ''),
        'state': 'enabled',
    })
    flag.state = state
    if not flag.label:
        flag.label = defaults.get('label', key)
    if not flag.description:
        flag.description = defaults.get('description', '')
    flag.save()
    cache.delete('features:all')
    return Response({'key': flag.key, 'state': flag.state, 'label': flag.label})


@api_view(['GET'])
@permission_classes([AllowAny])
def app_init(request):
    """Tek round-trip ile site-config + features + geo/check döner."""
    from apps.admin_panel.models import SiteSettings
    from .visitor_views import _get_geo_settings, _get_client_ip, _is_local_ip

    CACHE_KEY = 'init:combined:v1'
    cached_static = cache.get(CACHE_KEY)

    if cached_static is None:
        s, _ = SiteSettings.objects.get_or_create(id=1)
        site_config = {
            'siteName': s.site_name,
            'siteDescription': s.site_description,
            'logoUrl': s.logo_url,
            'faviconUrl': s.favicon_url,
            'primaryColor': s.primary_color,
            'registrationEnabled': s.registration_enabled,
            'maintenanceMode': s.maintenance_mode,
        }

        ensure_defaults()
        flags_qs = FeatureFlag.objects.all()
        flag_map = {f.key: f.state for f in flags_qs}
        details = []
        for f in flags_qs:
            defaults = DEFAULT_FLAG_MAP.get(f.key, {})
            details.append({
                'key': f.key, 'state': f.state,
                'label': f.label or defaults.get('label', f.key),
                'description': f.description or defaults.get('description', ''),
                'group': defaults.get('group', 'Diğer'),
            })
        features = {'flags': flag_map, 'details': details}

        cached_static = {'siteConfig': site_config, 'features': features}
        cache.set(CACHE_KEY, cached_static, 120)

    geo_cached = cache.get('geo_settings:v1')
    if geo_cached is None:
        from .visitor_views import _get_geo_settings
        s = _get_geo_settings()
        geo_cached = {
            'is_enabled': s.is_enabled, 'mode': s.mode,
            'countries': s.countries or [], 'message': s.message,
            'redirect_url': s.redirect_url,
        }
        cache.set('geo_settings:v1', geo_cached, 300)

    if not geo_cached['is_enabled']:
        geo = {'blocked': False, 'country': None, 'enabled': False}
    else:
        from .visitor_views import _get_client_ip, _is_local_ip
        ip = _get_client_ip(request)
        is_local = _is_local_ip(ip)
        country = 'LOCAL' if is_local else 'XX'
        countries = geo_cached['countries']
        mode = geo_cached['mode']
        if country == 'XX':
            blocked = False
        elif mode == 'allowlist':
            blocked = not is_local and bool(countries) and country not in countries
        else:
            blocked = country in countries
        geo = {
            'blocked': blocked, 'country': country, 'enabled': True,
            'mode': mode, 'message': geo_cached['message'],
            'redirectUrl': geo_cached['redirect_url'],
        }

    home_data = None
    if not request.user.is_authenticated:
        try:
            from apps.videos.views import HOME_CACHE_KEY, _build_home_data_anon
            home_data = cache.get(HOME_CACHE_KEY)
            if home_data is None:
                # Cache soğuksa burada ısıt — frontend ek /api/home isteği yapmak zorunda kalmaz
                home_data = _build_home_data_anon()
        except Exception:
            home_data = None

    result = {**cached_static, 'geo': geo, 'homeData': home_data}
    resp = Response(result)
    resp['Cache-Control'] = 'private, max-age=120, stale-while-revalidate=60'
    return resp


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return Response({'status': 'ok'})


@api_view(['GET'])
@permission_classes([AllowAny])
def recommendations(request):
    from apps.videos.models import Video
    from apps.videos.views import enrich_videos_bulk
    limit = min(int(request.query_params.get('limit', 20)), 50)
    if not request.user.is_authenticated:
        ck = f'recommendations:{limit}'
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)
        videos = list(Video.objects.filter(is_published=True).select_related('creator', 'category').order_by('-view_count', '-like_count')[:limit])
        result = {'videos': enrich_videos_bulk(videos, None)}
        cache.set(ck, result, 120)
        return Response(result)
    videos = list(Video.objects.filter(is_published=True).select_related('creator', 'category').order_by('-view_count', '-like_count')[:limit])
    return Response({'videos': enrich_videos_bulk(videos, request.user)})
