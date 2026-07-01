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

_ENSURE_CACHE_KEY = 'core:defaults_done:v1'


def ensure_defaults():
    """Eksik feature flag'leri DB'ye ekler.
    27 ayrı get_or_create yerine tek bulk_create kullanır → ~1ms."""
    global _initialized
    if _initialized:
        return
    # Cache ile process'ler arası koordinasyon
    if cache.get(_ENSURE_CACHE_KEY):
        _initialized = True
        return

    existing_keys = set(FeatureFlag.objects.values_list('key', flat=True))
    to_create = [
        FeatureFlag(key=f['key'], label=f['label'], description=f['description'], state='enabled')
        for f in DEFAULT_FLAGS if f['key'] not in existing_keys
    ]
    if to_create:
        FeatureFlag.objects.bulk_create(to_create, ignore_conflicts=True)

    cache.set(_ENSURE_CACHE_KEY, True, 3600)
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
    invalidate_init_cache()
    return Response({'key': flag.key, 'state': flag.state, 'label': flag.label})


def _build_init_anon():
    """
    Anonim kullanıcı için tam /api/init yanıtını oluşturur.
    Sadece cache süresi dolduğunda çağrılır; sonuç 30 sn önbellekte kalır.
    """
    from apps.admin_panel.models import SiteSettings
    from .visitor_views import _get_geo_settings

    # ── siteConfig ──────────────────────────────────────────────────────
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

    # ── features ────────────────────────────────────────────────────────
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

    # ── geo (geo kısıtlama etkin değilse varsayılan) ─────────────────────
    geo_s = _get_geo_settings()
    if not geo_s.is_enabled:
        geo = {'blocked': False, 'country': None, 'enabled': False}
    else:
        geo = {
            'blocked': False, 'country': 'XX', 'enabled': True,
            'mode': geo_s.mode, 'message': geo_s.message,
            'redirectUrl': geo_s.redirect_url,
        }

    # ── homeData ─────────────────────────────────────────────────────────
    try:
        from apps.videos.views import _build_home_data_anon
        home_data = _build_home_data_anon()
    except Exception:
        home_data = None

    return {
        'siteConfig': site_config,
        'features': features,
        'geo': geo,
        'homeData': home_data,
        'me': None,
    }


# Tam anonim yanıt için cache anahtarları
_ANON_INIT_CACHE_KEY = 'init:anon:full:v3'
_ANON_INIT_LOCK_KEY  = 'init:anon:building:v3'   # thundering-herd lock
_ANON_INIT_TTL = 300  # saniye — 5 dakika cache; admin değişikliği anında invalidate_init_cache() ile temizlenir

# Admin yazma işlemlerinde temizlenecek tüm init cache anahtarları
INIT_CACHE_KEYS = [
    _ANON_INIT_CACHE_KEY,
    'init:combined:v1',
    'init:anon:full:v1',
    'init:anon:full:v2',
]


def invalidate_init_cache():
    """
    Site config / feature flag / geo değiştiğinde çağrılır.
    Tüm init önbelleklerini temizler → sonraki istek taze veri alır.
    """
    cache.delete_many(INIT_CACHE_KEYS)


def _build_init_anon_with_lock():
    """
    Thundering-herd korumalı _build_init_anon çağrısı.
    cache.add() sadece anahtar yoksa True döner → tek worker oluşturur,
    diğerleri kısa bekler ve hazır sonucu alır.
    """
    # Zaten biri oluşturuyor mu?
    if not cache.add(_ANON_INIT_LOCK_KEY, 1, 15):
        # Başka bir worker yapıyor; ~150ms bekle, sonra önbellekten al
        import time
        time.sleep(0.15)
        hit = cache.get(_ANON_INIT_CACHE_KEY)
        if hit is not None:
            return hit
        # Hâlâ boşsa (çok nadiren) biz de oluşturalım — stale veri yok
    try:
        result = _build_init_anon()
        cache.set(_ANON_INIT_CACHE_KEY, result, _ANON_INIT_TTL)
        return result
    finally:
        cache.delete(_ANON_INIT_LOCK_KEY)


@api_view(['GET'])
@permission_classes([AllowAny])
def app_init(request):
    """
    Tek round-trip ile site-config + features + geo + homeData döner.

    Anonim istekler: tüm yanıt 30 sn önbellekte → DB'ye hiç gitmez.
    Giriş yapmış kullanıcılar: /api/me eklendiği için kişisel önbellek kullanılır.
    """
    if not request.user.is_authenticated:
        # ── Tam anonim yanıt önbelleği ──────────────────────────────────
        # public + s-maxage: Cloudflare edge + nginx proxy_cache bu yanıtı cache'ler.
        # Kullanıcı Türkiye'den bağlanıyorsa CF'nin Frankfurt/Warsaw node'undan alır.
        _CC = 'public, s-maxage=60, max-age=60, stale-while-revalidate=120'
        cached = cache.get(_ANON_INIT_CACHE_KEY)
        if cached is not None:
            resp = Response(cached)
            resp['Cache-Control'] = _CC
            resp['X-Cache'] = 'HIT'
            return resp

        result = _build_init_anon_with_lock()
        resp = Response(result)
        resp['Cache-Control'] = _CC
        resp['X-Cache'] = 'MISS'
        return resp

    # ── Giriş yapmış kullanıcı: statik kısımlar önbellekten, me kişisel ──
    STATIC_KEY = 'init:combined:v1'
    cached_static = cache.get(STATIC_KEY)
    if cached_static is None:
        base = _build_init_anon()
        cached_static = {k: base[k] for k in ('siteConfig', 'features', 'geo')}
        cache.set(STATIC_KEY, cached_static, 120)

    me_data = None
    try:
        from apps.accounts.views import format_user
        me_data = format_user(request.user)
    except Exception:
        pass

    result = {**cached_static, 'homeData': None, 'me': me_data}
    resp = Response(result)
    resp['Cache-Control'] = 'private, no-store'
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
