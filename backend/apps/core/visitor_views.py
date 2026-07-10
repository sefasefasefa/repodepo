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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_visitors_chart(request):
    if request.user.role not in ('admin', 'moderator'):
        return Response({'error': 'Admin gerekli'}, status=403)

    period = request.GET.get('period', '24h')
    country_filter = request.GET.get('country', '')

    td = PERIODS.get(period)
    qs = VisitorLog.objects.all()
    if td is not None:
        since = timezone.now() - td
        qs = qs.filter(timestamp__gte=since)
    if country_filter:
        qs = qs.filter(country=country_filter)

    # Determine bucket size based on period
    if period in ('5min', '1h'):
        # bucket by minute
        bucket = 'minute'
    elif period in ('24h', '7d'):
        # bucket by hour
        bucket = 'hour'
    else:
        # bucket by day
        bucket = 'day'

    from django.db.models import Count
    from django.db.models.functions import TruncMinute, TruncHour, TruncDay

    trunc_fn = {'minute': TruncMinute, 'hour': TruncHour, 'day': TruncDay}[bucket]
    rows = (
        qs.annotate(bucket=trunc_fn('timestamp'))
          .values('bucket')
          .annotate(visits=Count('id'), unique=Count('session_id', distinct=True))
          .order_by('bucket')
    )

    points = [
        {
            'time': r['bucket'].isoformat(),
            'visits': r['visits'],
            'unique': r['unique'],
        }
        for r in rows
    ]

    return Response({'bucket': bucket, 'period': period, 'points': points})


# ─── Visitor Report helpers ───────────────────────────────────────────────────

def _get_report_settings():
    s = VisitorReportSettings.objects.first()
    if not s:
        s = VisitorReportSettings.objects.create()
    return s


def _build_report_stats(days=7):
    """Compute stats dict for the report covering the last `days` days."""
    since = timezone.now() - timedelta(days=days)
    qs = VisitorLog.objects.filter(timestamp__gte=since)
    logs = list(qs.values('session_id', 'country', 'page', 'timestamp'))

    total_visits = len(logs)
    unique_sessions = len(set(l['session_id'] for l in logs))

    country_counts: dict = defaultdict(int)
    page_counts: dict = defaultdict(int)
    for l in logs:
        if l['country']:
            country_counts[l['country']] += 1
        page_counts[l['page']] += 1

    top_countries = sorted(country_counts.items(), key=lambda x: -x[1])[:10]
    top_pages = sorted(page_counts.items(), key=lambda x: -x[1])[:10]

    # Previous period for comparison
    prev_since = since - timedelta(days=days)
    prev_total = VisitorLog.objects.filter(timestamp__gte=prev_since, timestamp__lt=since).count()
    change_pct = round(((total_visits - prev_total) / max(prev_total, 1)) * 100, 1)

    return {
        'total_visits': total_visits,
        'unique_sessions': unique_sessions,
        'top_countries': top_countries,
        'top_pages': top_pages,
        'change_pct': change_pct,
        'prev_total': prev_total,
        'days': days,
    }


COUNTRY_NAMES_PY = {
    'TR': 'Türkiye', 'US': 'ABD', 'GB': 'Birleşik Krallık', 'DE': 'Almanya',
    'FR': 'Fransa', 'JP': 'Japonya', 'BR': 'Brezilya', 'RU': 'Rusya',
    'AU': 'Avustralya', 'IN': 'Hindistan', 'CA': 'Kanada', 'ES': 'İspanya',
    'IT': 'İtalya', 'NL': 'Hollanda', 'AE': 'BAE', 'SG': 'Singapur', 'MX': 'Meksika',
}

PAGE_LABELS_PY = {
    '/': 'Ana Sayfa', '/videos': 'Videolar', '/shorts': 'Shorts',
    '/login': 'Giriş', '/register': 'Kayıt', '/pricing': 'Fiyatlar',
}


def _fmt_page(page):
    if page in PAGE_LABELS_PY:
        return PAGE_LABELS_PY[page]
    if page.startswith('/videos/'):
        return 'Video İzleme'
    if page.startswith('/creator/'):
        return 'Creator'
    if page.startswith('/categories/'):
        return 'Kategori'
    return page


def _build_report_html(stats, site_name='Hotpulse', site_url=''):
    from django.utils.timezone import now as tz_now
    date_str = tz_now().strftime('%d %B %Y')
    days = stats['days']
    period_label = f'Son {days} gün'
    change_sign = '+' if stats['change_pct'] >= 0 else ''
    change_color = '#22c55e' if stats['change_pct'] >= 0 else '#ef4444'

    country_rows = ''.join(
        f'<tr><td style="padding:6px 12px;color:#ccc;">{i+1}. {COUNTRY_NAMES_PY.get(c, c)}</td>'
        f'<td style="padding:6px 12px;color:#fff;font-weight:bold;text-align:right;">{n}</td></tr>'
        for i, (c, n) in enumerate(stats['top_countries'])
    )
    page_rows = ''.join(
        f'<tr><td style="padding:6px 12px;color:#ccc;">{_fmt_page(p)}</td>'
        f'<td style="padding:6px 12px;color:#a855f7;font-weight:bold;text-align:right;">{n}</td></tr>'
        for p, n in stats['top_pages']
    )

    return f"""<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><title>{site_name} — Ziyaretçi Raporu</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #1e1e1e;border-radius:16px;overflow:hidden;">

  <!-- Header -->
  <tr><td style="background:linear-gradient(135deg,#1a0533,#0f0f1a);padding:36px 40px;text-align:center;">
    <h1 style="margin:0;color:#a855f7;font-size:28px;letter-spacing:-0.5px;">{site_name}</h1>
    <p style="margin:8px 0 0;color:#888;font-size:14px;">Ziyaretçi Analiz Raporu — {date_str}</p>
    <p style="margin:4px 0 0;color:#555;font-size:12px;">{period_label}</p>
  </td></tr>

  <!-- Stats -->
  <tr><td style="padding:32px 40px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="50%" style="padding-right:8px;">
          <div style="background:#1e1e1e;border:1px solid #2a2a2a;border-radius:12px;padding:20px;text-align:center;">
            <p style="margin:0;color:#666;font-size:12px;">Toplam Ziyaret</p>
            <p style="margin:8px 0 0;color:#fff;font-size:36px;font-weight:800;">{stats['total_visits']}</p>
            <p style="margin:4px 0 0;font-size:12px;color:{change_color};">{change_sign}{stats['change_pct']}% önceki döneme göre</p>
          </div>
        </td>
        <td width="50%" style="padding-left:8px;">
          <div style="background:#1e1e1e;border:1px solid #2a2a2a;border-radius:12px;padding:20px;text-align:center;">
            <p style="margin:0;color:#666;font-size:12px;">Tekil Ziyaretçi</p>
            <p style="margin:8px 0 0;color:#22c55e;font-size:36px;font-weight:800;">{stats['unique_sessions']}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#555;">benzersiz oturum</p>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Top Countries -->
  <tr><td style="padding:24px 40px 0;">
    <h3 style="margin:0 0 12px;color:#aaa;font-size:14px;font-weight:600;">🌍 En Fazla Ziyaretçi — Ülke</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:10px;overflow:hidden;">
      {'<tr><td style="padding:12px;color:#555;text-align:center;font-size:12px;">Veri yok</td></tr>' if not stats['top_countries'] else country_rows}
    </table>
  </td></tr>

  <!-- Top Pages -->
  <tr><td style="padding:20px 40px 0;">
    <h3 style="margin:0 0 12px;color:#aaa;font-size:14px;font-weight:600;">📄 En Çok Ziyaret Edilen Sayfalar</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:10px;overflow:hidden;">
      {'<tr><td style="padding:12px;color:#555;text-align:center;font-size:12px;">Veri yok</td></tr>' if not stats['top_pages'] else page_rows}
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:32px 40px;text-align:center;border-top:1px solid #1e1e1e;margin-top:24px;">
    <p style="margin:0;color:#555;font-size:12px;">{site_name} Admin Raporu — Otomatik Gönderildi</p>
    {'<p style="margin:6px 0 0;"><a href="' + site_url + '/panel/analytics" style="color:#a855f7;font-size:12px;text-decoration:none;">Detaylı analiz için tıklayın →</a></p>' if site_url else ''}
  </td></tr>

</table>
</td></tr>
</table>
</body></html>"""


def _send_visitor_report_now(settings_obj=None):
    """Generate and send the visitor report. Returns (ok, message)."""
    from django.core.mail import EmailMultiAlternatives
    from django.conf import settings as dj_settings

    s = settings_obj or _get_report_settings()
    if not s.recipients:
        return False, 'Alıcı listesi boş'

    days_map = {'daily': 1, 'weekly': 7, 'monthly': 30}
    days = days_map.get(s.frequency, 7)

    stats = _build_report_stats(days=days)
    site_name = getattr(dj_settings, 'SITE_NAME', 'Hotpulse')
    site_url = getattr(dj_settings, 'SITE_URL', '')
    html = _build_report_html(stats, site_name=site_name, site_url=site_url)

    period_label = {'daily': 'Günlük', 'weekly': 'Haftalık', 'monthly': 'Aylık'}.get(s.frequency, 'Haftalık')
    subject = f'{site_name} {period_label} Ziyaretçi Raporu — {stats["total_visits"]} ziyaret'

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=f'{site_name} {period_label} Ziyaretçi Raporu\n\n'
                 f'Toplam ziyaret: {stats["total_visits"]}\n'
                 f'Tekil ziyaretçi: {stats["unique_sessions"]}\n',
            from_email=dj_settings.DEFAULT_FROM_EMAIL,
            to=s.recipients,
        )
        msg.attach_alternative(html, 'text/html')
        msg.send()
        s.last_sent = timezone.now()
        s.save(update_fields=['last_sent'])
        return True, f'{len(s.recipients)} alıcıya gönderildi'
    except Exception as e:
        return False, str(e)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def visitor_report_settings(request):
    if request.user.role not in ('admin', 'moderator'):
        return Response({'error': 'Admin gerekli'}, status=403)
    s = _get_report_settings()
    if request.method == 'GET':
        return Response({
            'isEnabled': s.is_enabled,
            'recipients': s.recipients or [],
            'frequency': s.frequency,
            'dayOfWeek': s.day_of_week,
            'hour': s.hour,
            'lastSent': s.last_sent.isoformat() if s.last_sent else None,
        })
    d = request.data
    if 'isEnabled' in d:
        s.is_enabled = bool(d['isEnabled'])
    if 'recipients' in d:
        s.recipients = [e.strip() for e in d['recipients'] if e.strip()]
    if 'frequency' in d and d['frequency'] in ('daily', 'weekly', 'monthly'):
        s.frequency = d['frequency']
    if 'dayOfWeek' in d:
        s.day_of_week = int(d['dayOfWeek'])
    if 'hour' in d:
        s.hour = max(0, min(23, int(d['hour'])))
    s.save()
    return Response({'ok': True, 'isEnabled': s.is_enabled, 'frequency': s.frequency})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def visitor_report_send(request):
    if request.user.role not in ('admin', 'moderator'):
        return Response({'error': 'Admin gerekli'}, status=403)
    s = _get_report_settings()
    ok, msg = _send_visitor_report_now(s)
    if ok:
        return Response({'ok': True, 'message': msg})
    return Response({'ok': False, 'message': msg}, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def visitor_report_preview(request):
    if request.user.role not in ('admin', 'moderator'):
        return Response({'error': 'Admin gerekli'}, status=403)
    from django.conf import settings as dj_settings
    from django.http import HttpResponse
    s = _get_report_settings()
    days_map = {'daily': 1, 'weekly': 7, 'monthly': 30}
    days = days_map.get(s.frequency, 7)
    stats = _build_report_stats(days=days)
    site_name = getattr(dj_settings, 'SITE_NAME', 'Hotpulse')
    site_url = getattr(dj_settings, 'SITE_URL', '')
    html = _build_report_html(stats, site_name=site_name, site_url=site_url)
    return HttpResponse(html, content_type='text/html')


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
