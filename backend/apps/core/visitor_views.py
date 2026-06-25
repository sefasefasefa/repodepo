"""Visitor tracking + geo endpoints (port of Express /track and /geo)."""
import time
import hashlib
import threading
from collections import defaultdict
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import GeoRestrictionSettings

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
        # No GeoIP library installed — return Unknown but record session
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
    return Response({'ok': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_visitors(request):
    if request.user.role not in ('admin', 'moderator'):
        return Response({'error': 'Admin gerekli'}, status=403)
    _prune_sessions()
    with _sessions_lock:
        active = list(_sessions.values())

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
        'visitors': [{
            'id': v['id'], 'lat': v['lat'], 'lng': v['lng'],
            'country': v['country'], 'city': v['city'], 'page': v['page'],
            'lastSeen': v['last_seen'],
        } for v in active],
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
    s = _get_geo_settings()
    if not s.is_enabled:
        return Response({'blocked': False, 'country': None, 'enabled': False})
    # No external IP lookup — return LOCAL for local IPs, XX otherwise.
    ip = _get_client_ip(request)
    country = 'LOCAL' if _is_local_ip(ip) else 'XX'
    countries = s.countries or []
    if s.mode == 'allowlist':
        blocked = country != 'LOCAL' and bool(countries) and country not in countries
    else:
        blocked = country in countries
    return Response({
        'blocked': blocked, 'country': country, 'enabled': True,
        'mode': s.mode, 'message': s.message, 'redirectUrl': s.redirect_url,
    })


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
