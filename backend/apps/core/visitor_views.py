"""Visitor tracking + geo endpoints (port of Express /track and /geo)."""
import time
import hashlib
import threading
from collections import defaultdict
from datetime import timedelta
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.core.cache import cache

from .models import GeoRestrictionSettings, VisitorLog

# In-memory active-visitor session map (5-minute TTL).
_sessions = {}
_sessions_lock = threading.Lock()
MAX_AGE_S = 5 * 60

DEMO_LOCATIONS = [
    {'country': 'TR', 'city': 'Istanbul',    'lat': 41.01, 'lng': 28.97},
    {'country': 'TR', 'city': 'Ankara',      'lat': 39.93, 'lng': 32.86},
    {'country': 'TR', 'city': 'Izmir',       'lat': 38.41, 'lng': 27.14},
    {'country': 'DE', 'city': 'Berlin',      'lat': 52.52, 'lng': 13.40},
    {'country': 'US', 'city': 'New York',    'lat': 40.71, 'lng': -74.01},
    {'country': 'US', 'city': 'Los Angeles', 'lat': 34.05, 'lng': -118.24},
    {'country': 'GB', 'city': 'London',      'lat': 51.51, 'lng': -0.13},
    {'country': 'FR', 'city': 'Paris',       'lat': 48.85, 'lng': 2.35},
    {'country': 'JP', 'city': 'Tokyo',       'lat': 35.69, 'lng': 139.69},
    {'country': 'BR', 'city': 'São Paulo',   'lat': -23.55, 'lng': -46.63},
    {'country': 'RU', 'city': 'Moscow',      'lat': 55.75, 'lng': 37.62},
    {'country': 'AU', 'city': 'Sydney',      'lat': -33.87, 'lng': 151.21},
    {'country': 'IN', 'city': 'Mumbai',      'lat': 19.08, 'lng': 72.88},
    {'country': 'CA', 'city': 'Toronto',     'lat': 43.65, 'lng': -79.38},
    {'country': 'ES', 'city': 'Madrid',      'lat': 40.42, 'lng': -3.70},
    {'country': 'IT', 'city': 'Rome',        'lat': 41.90, 'lng': 12.50},
    {'country': 'NL', 'city': 'Amsterdam',   'lat': 52.37, 'lng': 4.90},
    {'country': 'AE', 'city': 'Dubai',       'lat': 25.20, 'lng': 55.27},
    {'country': 'SG', 'city': 'Singapore',   'lat': 1.35,  'lng': 103.82},
    {'country': 'MX', 'city': 'Mexico City', 'lat': 19.43, 'lng': -99.13},
]

# Period -> timedelta mapping (None = all-time)
PERIODS = {
    '5min':  timedelta(minutes=5),
    '1h':    timedelta(hours=1),
    '24h':   timedelta(hours=24),
    '7d':    timedelta(days=7),
    '30d':   timedelta(days=30),
    'all':   None,
}


def _is_local_ip(ip):
    if not ip:
        return True
    return (
        ip in ('127.0.0.1', '::1', '::ffff:127.0.0.1')
        or ip.startswith('10.')
        or ip.startswith('192.168.')
        or any(ip.startswith(f'172.{x}') for x in range(16, 32))
    )


def _get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '127.0.0.1')


def _prune_sessions():
    now = time.time()
    with _sessions_lock:
        stale = [k for k, s in _sessions.items() if now - s['last_seen'] > MAX_AGE_S]
        for k in stale:
            del _sessions[k]


@api_view(['POST'])
@permission_classes([AllowAny])
def track_visitor(request):
    ip = _get_client_ip(request)
    page = request.data.get('page', '/')
    session_id = request.data.get('sessionId')
    user_id = request.data.get('userId')

    if not session_id:
        return Response({'ok': True})

    # Pick a demo location deterministically from session id for local IPs
    if _is_local_ip(ip):
        h = int(hashlib.md5(str(session_id).encode()).hexdigest(), 16)
        loc = DEMO_LOCATIONS[h % len(DEMO_LOCATIONS)]
        country, city, lat, lng = loc['country'], loc['city'], loc['lat'], loc['lng']
    else:
        country, city, lat, lng = 'Unknown', '', 0.0, 0.0

    with _sessions_lock:
        existing = _sessions.get(session_id)
        _sessions[session_id] = {
            'id': session_id, 'ip': ip,
            'country': country, 'city': city,
            'lat': existing['lat'] if existing else lat,
            'lng': existing['lng'] if existing else lng,
            'page': page, 'last_seen': time.time(), 'user_id': user_id,
        }

    # Persist to DB (fire and forget — don't block the response)
    try:
        VisitorLog.objects.create(
            session_id=session_id,
            country=country,
            city=city,
            lat=lat,
            lng=lng,
            page=page,
        )
    except Exception:
        pass

    return Response({'ok': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_visitors(request):
    if request.user.role not in ('admin', 'moderator'):
        return Response({'error': 'Admin gerekli'}, status=403)

    period = request.GET.get('period', '5min')
    country_filter = request.GET.get('country', '')

    if period == '5min':
        # Live mode: use in-memory sessions
        _prune_sessions()
        with _sessions_lock:
            active = list(_sessions.values())

        if country_filter:
            active = [v for v in active if v['country'] == country_filter]

        country_counts = defaultdict(int)
        page_counts = defaultdict(int)
        for v in active:
            country_counts[v['country']] += 1
            page_counts[v['page']] += 1

        top_countries = [{'country': c, 'count': n} for c, n in
                         sorted(country_counts.items(), key=lambda x: -x[1])[:10]]
        top_pages = [{'page': p, 'count': n} for p, n in
                     sorted(page_counts.items(), key=lambda x: -x[1])[:10]]

        return Response({
            'total': len(active),
            'uniqueSessions': len(active),
            'mode': 'live',
            'visitors': [{
                'id': v['id'], 'lat': v['lat'], 'lng': v['lng'],
                'country': v['country'], 'city': v['city'], 'page': v['page'],
                'lastSeen': v['last_seen'],
            } for v in active],
            'topCountries': top_countries,
            'topPages': top_pages,
        })

    # Historical mode: query VisitorLog DB
    td = PERIODS.get(period)
    qs = VisitorLog.objects.all()
    if td is not None:
        since = timezone.now() - td
        qs = qs.filter(timestamp__gte=since)
    if country_filter:
        qs = qs.filter(country=country_filter)

    logs = list(qs.values('session_id', 'country', 'city', 'lat', 'lng', 'page', 'timestamp').order_by('-timestamp'))

    # Deduplicate: one marker per session (latest location)
    seen_sessions = {}
    for log in logs:
        sid = log['session_id']
        if sid not in seen_sessions:
            seen_sessions[sid] = log

    visitors = list(seen_sessions.values())

    country_counts = defaultdict(int)
    page_counts = defaultdict(int)
    for log in logs:
        country_counts[log['country']] += 1
        page_counts[log['page']] += 1

    top_countries = [{'country': c, 'count': n} for c, n in
                     sorted(country_counts.items(), key=lambda x: -x[1])[:10]]
    top_pages = [{'page': p, 'count': n} for p, n in
                 sorted(page_counts.items(), key=lambda x: -x[1])[:10]]

    return Response({
        'total': len(logs),
        'uniqueSessions': len(seen_sessions),
        'mode': 'historical',
        'visitors': [{
            'id': str(v['session_id']),
            'lat': v['lat'], 'lng': v['lng'],
            'country': v['country'], 'city': v['city'],
            'page': v['page'],
            'lastSeen': v['timestamp'].timestamp() if v['timestamp'] else 0,
        } for v in visitors[:200]],
        'topCountries': top_countries,
        'topPages': top_pages,
    })


# ─── Geo restriction ──────────────────────────────────────────────────────────

def _get_geo_settings():
    s = GeoRestrictionSettings.objects.first()
    if not s:
        s = GeoRestrictionSettings.objects.create()
    return s


@api_view(['GET'])
@permission_classes([AllowAny])
def geo_check(request):
    cached_settings = cache.get('geo_settings:v1')
    if cached_settings is None:
        s = _get_geo_settings()
        cached_settings = {
            'is_enabled': s.is_enabled, 'mode': s.mode,
            'countries': s.countries or [], 'message': s.message,
            'redirect_url': s.redirect_url,
        }
        cache.set('geo_settings:v1', cached_settings, 300)

    if not cached_settings['is_enabled']:
        resp = Response({'blocked': False, 'country': None, 'enabled': False})
        resp['Cache-Control'] = 'public, max-age=600, stale-while-revalidate=120'
        return resp

    ip = _get_client_ip(request)
    is_local = _is_local_ip(ip)
    country = 'LOCAL' if is_local else 'XX'
    countries = cached_settings['countries']
    mode = cached_settings['mode']
    if country == 'XX':
        blocked = False
    elif mode == 'allowlist':
        blocked = not is_local and bool(countries) and country not in countries
    else:
        blocked = country in countries
    resp = Response({
        'blocked': blocked, 'country': country, 'enabled': True,
        'mode': mode, 'message': cached_settings['message'],
        'redirectUrl': cached_settings['redirect_url'],
    })
    resp['Cache-Control'] = 'private, max-age=600'
    return resp


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def geo_admin_settings(request):
    if request.user.role != 'admin':
        return Response({'error': 'Admin gerekli'}, status=403)
    s = _get_geo_settings()
    if request.method == 'GET':
        return Response({'settings': {
            'id': s.id, 'isEnabled': s.is_enabled, 'mode': s.mode,
            'countries': s.countries or [], 'redirectUrl': s.redirect_url,
            'message': s.message,
        }})
    d = request.data
    if 'isEnabled' in d:
        s.is_enabled = bool(d['isEnabled'])
    if 'mode' in d:
        s.mode = d['mode']
    if 'countries' in d:
        s.countries = list(d['countries'])
    if 'redirectUrl' in d:
        s.redirect_url = d['redirectUrl'] or None
    if 'message' in d:
        s.message = d['message']
    s.save()
    return Response({'settings': {
        'id': s.id, 'isEnabled': s.is_enabled, 'mode': s.mode,
        'countries': s.countries or [], 'redirectUrl': s.redirect_url,
        'message': s.message,
    }})
