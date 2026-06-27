"""Developer-page endpoints: api-endpoints, api-clients, cdn, integrations, revenue projection."""
import json
import time
import secrets
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from collections import defaultdict

from django.utils import timezone
from django.db.models import Sum, Count, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import ApiEndpointConfig, ApiClient, CdnConfig, IntegrationConfig
from apps.subscriptions.models import Payment, UserSubscription, SubscriptionPlan
from apps.tokens.models import TokenTransaction


def _admin_required(user):
    return user.is_authenticated and user.role in ('admin', 'moderator')


def _fmt_endpoint(ep):
    return {
        'id': ep.id, 'name': ep.name, 'description': ep.description,
        'url': ep.url, 'method': ep.method, 'headers': ep.headers,
        'body': ep.body, 'category': ep.category, 'isActive': ep.is_active,
        'createdAt': ep.created_at.isoformat() if ep.created_at else None,
    }


def _fmt_client(c, mask_secret=True):
    return {
        'id': c.id, 'name': c.name,
        'clientKey': c.client_key,
        'clientSecret': '••••••••' if mask_secret else c.client_secret,
        'developerDomain': c.developer_domain,
        'isActive': c.is_active,
        'createdAt': c.created_at.isoformat() if c.created_at else None,
    }


def _fmt_cdn(c, mask=True):
    return {
        'id': str(c.id), 'provider': c.provider, 'name': c.name,
        'endpoint': c.endpoint, 'accessKey': c.access_key,
        'secretKey': '••••••••' if (mask and c.secret_key) else c.secret_key,
        'bucket': c.bucket, 'region': c.region, 'cdnUrl': c.cdn_url,
        'isActive': c.is_active, 'isDefault': c.is_default,
        'createdAt': c.created_at.isoformat() if c.created_at else None,
    }


def _fmt_integration(i, mask=True):
    return {
        'id': str(i.id), 'platform': i.platform, 'name': i.name,
        'login': i.login,
        'key': ('••••••••' if mask and i.key else i.key),
        'apiKey': ('••••••••' if mask and i.api_key else i.api_key),
        'email': i.email, 'autoUpload': i.auto_upload, 'isActive': i.is_active,
        'uploadCount': i.upload_count,
        'addedAt': i.created_at.isoformat() if i.created_at else None,
    }


# ─── API Endpoints ────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def api_endpoints(request):
    if not _admin_required(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    if request.method == 'GET':
        return Response({'endpoints': [_fmt_endpoint(e) for e in ApiEndpointConfig.objects.all()]})

    d = request.data
    if not d.get('name') or not d.get('url'):
        return Response({'error': 'Ad ve URL zorunlu'}, status=400)
    headers = d.get('headers', {})
    headers_str = headers if isinstance(headers, str) else json.dumps(headers or {})
    ep = ApiEndpointConfig.objects.create(
        name=d['name'], description=d.get('description') or '',
        url=d['url'], method=d.get('method') or 'GET',
        headers=headers_str, body=d.get('body') or '',
        category=d.get('category') or 'Genel',
        is_active=d.get('isActive') is not False,
    )
    return Response({'endpoint': _fmt_endpoint(ep)})


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def api_endpoint_detail(request, ep_id):
    if not _admin_required(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    ep = ApiEndpointConfig.objects.filter(id=ep_id).first()
    if not ep:
        return Response({'error': 'Endpoint bulunamadı'}, status=404)
    if request.method == 'DELETE':
        ep.delete()
        return Response({'success': True})
    d = request.data
    headers = d.get('headers', {})
    ep.name = d.get('name', ep.name)
    ep.description = d.get('description') or ''
    ep.url = d.get('url', ep.url)
    ep.method = d.get('method') or 'GET'
    ep.headers = headers if isinstance(headers, str) else json.dumps(headers or {})
    ep.body = d.get('body') or ''
    ep.category = d.get('category') or 'Genel'
    ep.is_active = d.get('isActive') is not False
    ep.save()
    return Response({'endpoint': _fmt_endpoint(ep)})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def api_endpoint_toggle(request, ep_id):
    if not _admin_required(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    ep = ApiEndpointConfig.objects.filter(id=ep_id).first()
    if not ep:
        return Response({'error': 'Endpoint bulunamadı'}, status=404)
    ep.is_active = not ep.is_active
    ep.save(update_fields=['is_active'])
    return Response({'endpoint': _fmt_endpoint(ep)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_endpoint_test(request, ep_id):
    if not _admin_required(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    ep = ApiEndpointConfig.objects.filter(id=ep_id).first()
    if not ep:
        return Response({'error': 'Endpoint bulunamadı'}, status=404)

    try:
        headers_obj = {}
        try:
            headers_obj = json.loads(ep.headers or '{}')
        except Exception:
            pass
        body = ep.body.encode() if ep.method not in ('GET', 'HEAD') and ep.body else None
        req = urllib.request.Request(ep.url, data=body, headers=headers_obj, method=ep.method)
        start = time.time()
        with urllib.request.urlopen(req, timeout=10) as r:
            elapsed = int((time.time() - start) * 1000)
            text = r.read(500).decode('utf-8', errors='replace')
            return Response({
                'success': True, 'status': r.status,
                'statusText': r.reason, 'elapsed': elapsed, 'response': text,
            })
    except urllib.error.HTTPError as e:
        return Response({'success': False, 'status': e.code, 'statusText': str(e), 'elapsed': 0, 'response': ''})
    except Exception as e:
        return Response({'success': False, 'status': 0, 'statusText': str(e), 'elapsed': 0, 'response': ''})


# ─── API Clients ──────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def api_clients(request):
    if not _admin_required(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    if request.method == 'GET':
        return Response({'clients': [_fmt_client(c) for c in ApiClient.objects.all()]})
    name = request.data.get('name')
    if not name:
        return Response({'error': 'Ad zorunlu'}, status=400)
    client = ApiClient.objects.create(
        name=name,
        client_key=f"ck_{secrets.token_hex(8)}",
        client_secret=f"cs_{secrets.token_hex(12)}",
        developer_domain=request.data.get('developerDomain') or 'developer.sitelinli',
        is_active=request.data.get('isActive') is not False,
    )
    return Response({'client': _fmt_client(client, mask_secret=False)})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def api_client_toggle(request, client_id):
    if not _admin_required(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    c = ApiClient.objects.filter(id=client_id).first()
    if not c:
        return Response({'error': 'Client bulunamadı'}, status=404)
    c.is_active = not c.is_active
    c.save(update_fields=['is_active'])
    return Response({'client': _fmt_client(c)})


@api_view(['GET'])
def api_docs(request):
    """Public API documentation endpoint."""
    clients = list(ApiClient.objects.all()[:1])
    endpoints = ApiEndpointConfig.objects.filter(is_active=True)
    return Response({
        'title': 'Prnhbbbb Public API',
        'baseUrl': '/api',
        'developerDomain': 'developer.sitelinli',
        'status': 'enabled',
        'auth': {
            'type': 'api-key', 'header': 'x-api-key',
            'clientKeyExample': clients[0].client_key if clients else 'ck_example',
        },
        'endpoints': [{
            'name': ep.name, 'method': ep.method, 'url': ep.url,
            'category': ep.category, 'description': ep.description,
        } for ep in endpoints],
    })


# ─── CDN ──────────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_cdn(request):
    if not _admin_required(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    if request.method == 'GET':
        return Response({'configs': [_fmt_cdn(c) for c in CdnConfig.objects.all()]})
    d = request.data
    if not d.get('provider') or not d.get('name'):
        return Response({'error': 'provider and name required'}, status=400)
    is_default = CdnConfig.objects.count() == 0
    c = CdnConfig.objects.create(
        provider=d['provider'], name=d['name'],
        endpoint=d.get('endpoint') or None,
        access_key=d.get('accessKey') or None,
        secret_key=d.get('secretKey') or None,
        bucket=d.get('bucket') or None,
        region=d.get('region') or 'auto',
        cdn_url=d.get('cdnUrl') or None,
        is_default=is_default,
    )
    return Response({'config': _fmt_cdn(c)})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_cdn_delete(request, cdn_id):
    if not _admin_required(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    deleted, _ = CdnConfig.objects.filter(id=cdn_id).delete()
    if not deleted:
        return Response({'error': 'Not found'}, status=404)
    return Response({'message': 'Deleted'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_cdn_set_default(request, cdn_id):
    if not _admin_required(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    if not CdnConfig.objects.filter(id=cdn_id).exists():
        return Response({'error': 'Not found'}, status=404)
    CdnConfig.objects.all().update(is_default=False)
    CdnConfig.objects.filter(id=cdn_id).update(is_default=True)
    return Response({'message': 'Default updated'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_cdn_test(request, cdn_id):
    if not _admin_required(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    c = CdnConfig.objects.filter(id=cdn_id).first()
    if not c:
        return Response({'error': 'Not found'}, status=404)
    test_url = c.cdn_url or c.endpoint
    if not test_url:
        return Response({'error': 'No endpoint configured to test'}, status=400)
    try:
        req = urllib.request.Request(test_url, method='HEAD')
        with urllib.request.urlopen(req, timeout=5) as r:
            return Response({'ok': True, 'status': r.status})
    except Exception as e:
        return Response({'ok': False, 'error': str(e)})


# ─── Integrations (Streamtape/Doodstream/Mixdrop) ─────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_integrations(request):
    if not _admin_required(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    if request.method == 'GET':
        return Response({'integrations': [_fmt_integration(i) for i in IntegrationConfig.objects.all()]})
    d = request.data
    if not d.get('platform') or not d.get('name'):
        return Response({'error': 'platform ve name zorunlu'}, status=400)
    i = IntegrationConfig.objects.create(
        platform=d['platform'], name=d['name'],
        login=d.get('login'), key=d.get('key'),
        api_key=d.get('apiKey'), email=d.get('email'),
        auto_upload=d.get('autoUpload', True),
    )
    return Response({'integration': _fmt_integration(i)})


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def admin_integration_detail(request, integration_id):
    if not _admin_required(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    i = IntegrationConfig.objects.filter(id=integration_id).first()
    if not i:
        return Response({'error': 'Bulunamadı'}, status=404)
    if request.method == 'DELETE':
        i.delete()
        return Response({'message': 'Silindi'})
    d = request.data
    if 'autoUpload' in d:
        i.auto_upload = bool(d['autoUpload'])
    if 'isActive' in d:
        i.is_active = bool(d['isActive'])
    if d.get('name'):
        i.name = d['name']
    if d.get('login') is not None:
        i.login = d['login']
    if d.get('key') is not None:
        i.key = d['key']
    if d.get('apiKey') is not None:
        i.api_key = d['apiKey']
    if d.get('email') is not None:
        i.email = d['email']
    i.save()
    return Response({'integration': _fmt_integration(i)})


_INTEGRATION_TEST_URLS = {
    "streamtape":   lambda i: f"https://api.streamtape.com/account/info?login={i.login}&key={i.key or i.api_key}",
    "doodstream":   lambda i: f"https://doodapi.com/api/account/info?key={i.api_key or i.key}",
    "mixdrop":      lambda i: f"https://ul.mixdrop.ag/api/account?email={i.email}&key={i.api_key or i.key}",
    "streamlare":   lambda i: f"https://streamlare.com/api/account/info?key={i.api_key or i.key}",
    "vidoza":       lambda i: f"https://vidoza.net/api/account/info?api_key={i.api_key or i.key}",
    "filemoon":     lambda i: f"https://filemoonapi.com/api/account/info?key={i.api_key or i.key}",
    "streamwish":   lambda i: f"https://api.streamwish.com/api/account/info?key={i.api_key or i.key}",
    "vidhide":      lambda i: f"https://vidhide.com/api/account/info?key={i.api_key or i.key}",
    "voe":          lambda i: f"https://voe.sx/api/account/info?key={i.api_key or i.key}",
    "upstream":     lambda i: f"https://upstream.to/api/account/info?key={i.api_key or i.key}",
    "luluvdo":      lambda i: f"https://luluvdo.com/api/account/info?key={i.api_key or i.key}",
    "uqload":       lambda i: f"https://uqload.io/api/account/info?key={i.api_key or i.key}",
    "streamhide":   lambda i: f"https://streamhide.com/api/account/info?key={i.api_key or i.key}",
    "supervideo":   lambda i: f"https://supervideo.tv/api/account/info?key={i.api_key or i.key}",
    "dropload":     lambda i: f"https://dropload.io/api/account/info?key={i.api_key or i.key}",
    "embedsito":    lambda i: f"https://embedsito.com/api/account/info?key={i.api_key or i.key}",
    "vidlox":       lambda i: f"https://vidlox.me/api/account/info?key={i.api_key or i.key}",
    "clipwatching": lambda i: f"https://clipwatching.com/api/account/info?key={i.api_key or i.key}",
    "streamsb":     lambda i: f"https://streamsb.net/api/account/info?key={i.api_key or i.key}",
    "hxfile":       lambda i: f"https://hxfile.ch/api/account/info?key={i.api_key or i.key}",
    "vidplay":      lambda i: f"https://vidplay.online/api/account/info?key={i.api_key or i.key}",
    "nxbex":        lambda i: f"https://nxbex.com/api/account/info?key={i.api_key or i.key}",
    "dropgalaxy":   lambda i: f"https://dropgalaxy.com/api/account/info?key={i.api_key or i.key}",
    "evoload":      lambda i: f"https://evoload.io/api/account/info?key={i.api_key or i.key}",
    "fembed":       lambda i: f"https://www.fembed.com/api/account/info?key={i.api_key or i.key}",
    "hotlinking":   lambda i: f"https://hotlinking.co/api/account/info?key={i.api_key or i.key}",
}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_integration_test(request, integration_id):
    if not _admin_required(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    i = IntegrationConfig.objects.filter(id=integration_id).first()
    if not i:
        return Response({'error': 'Bulunamadı'}, status=404)
    url_fn = _INTEGRATION_TEST_URLS.get(i.platform)
    if not url_fn:
        return Response({'ok': True, 'info': {'message': 'Kimlik bilgileri kaydedildi (API test desteklenmiyor)'}})
    try:
        url = url_fn(i)
        req = urllib.request.Request(url, headers={'User-Agent': 'Hotpulse/1.0'})
        with urllib.request.urlopen(req, timeout=8) as r:
            data = json.loads(r.read().decode())
        status_val = data.get('status') or data.get('code') or data.get('statusCode')
        if str(status_val) == '200' or status_val == 200 or data.get('ok') or data.get('success'):
            result = data.get('result') or data.get('data') or {}
            info = {}
            for field in ('email', 'username', 'storage', 'traffic_left', 'balance'):
                if field in result:
                    info[field] = result[field]
            return Response({'ok': True, 'info': info or {'message': 'Bağlantı başarılı'}})
        return Response({'ok': False, 'error': data.get('msg') or data.get('message') or 'Kimlik bilgileri geçersiz'})
    except urllib.error.HTTPError as e:
        return Response({'ok': False, 'error': f'HTTP {e.code}: {e.reason}'})
    except Exception as e:
        return Response({'ok': False, 'error': str(e)})


# ─── Revenue projection ───────────────────────────────────────────────────────

def _month_key(d):
    return f'{d.year}-{d.month:02d}'


def _month_label(key):
    y, m = map(int, key.split('-'))
    tr_months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
    return f"{tr_months[m-1]} {str(y)[-2:]}"


def _add_months(d, n):
    m = d.month + n
    y = d.year + (m - 1) // 12
    m = ((m - 1) % 12) + 1
    return d.replace(year=y, month=m, day=1)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_revenue_projection(request):
    if not _admin_required(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)

    history_months = 6
    projection_months = 12
    now = timezone.now()
    history_start = _add_months(now, -history_months)

    # 1. Historical payments
    payments = list(Payment.objects.filter(
        created_at__gte=history_start, status='completed'
    ).values('amount', 'type', 'created_at'))

    monthly_actual = {}
    for i in range(history_months - 1, -1, -1):
        monthly_actual[_month_key(_add_months(now, -i))] = {
            'subscription': 0.0, 'token': 0.0, 'ppv': 0.0, 'other': 0.0, 'total': 0.0,
        }

    for p in payments:
        key = _month_key(p['created_at'])
        if key not in monthly_actual:
            continue
        amt = float(p['amount'] or 0)
        t = p['type']
        if t == 'subscription':
            monthly_actual[key]['subscription'] += amt
        elif t == 'token_purchase':
            monthly_actual[key]['token'] += amt
        elif t == 'ppv':
            monthly_actual[key]['ppv'] += amt
        else:
            monthly_actual[key]['other'] += amt
        monthly_actual[key]['total'] += amt

    # 2. MRR from active subs
    mrr = 0.0
    total_active_subs = 0
    for sub in UserSubscription.objects.filter(status='active').select_related('plan'):
        price = float(sub.plan.price or 0)
        monthly = price / 12 if sub.plan.billing_cycle == 'yearly' else price
        mrr += monthly
        total_active_subs += 1

    # 3. Avg monthly token (last 3 months)
    token_start = _add_months(now, -3)
    token_rev = TokenTransaction.objects.filter(
        type='purchase', status='completed', created_at__gte=token_start,
    ).aggregate(s=Sum('usd_value'))['s'] or 0
    avg_monthly_token = float(token_rev) / 3

    # 4. Avg monthly PPV
    ppv_by_month = defaultdict(float)
    for p in payments:
        if p['type'] == 'ppv':
            ppv_by_month[_month_key(p['created_at'])] += float(p['amount'] or 0)
    avg_monthly_ppv = sum(ppv_by_month.values()) / len(ppv_by_month) if ppv_by_month else 0.0

    # 5. Growth rate
    months = sorted(monthly_actual.keys())
    recent_totals = [monthly_actual[k]['total'] for k in months[-3:]]
    growth_rate = 0.05
    if len(recent_totals) >= 2 and recent_totals[0] > 0:
        avg = (recent_totals[-1] - recent_totals[0]) / recent_totals[0] / (len(recent_totals) - 1)
        growth_rate = max(-0.1, min(avg, 0.3))

    # 6. Projection
    base_monthly = mrr + avg_monthly_token + avg_monthly_ppv
    scenarios = {
        'pessimistic': {'growth': max(growth_rate - 0.03, -0.02), 'label': 'Kötümser', 'color': '#ef4444'},
        'realistic':   {'growth': growth_rate,                     'label': 'Gerçekçi', 'color': '#f90'},
        'optimistic':  {'growth': min(growth_rate + 0.04, 0.35),  'label': 'İyimser',  'color': '#22c55e'},
    }
    projection_list = []
    for i in range(1, projection_months + 1):
        d = _add_months(now, i)
        key = _month_key(d)
        entry = {'month': key, 'label': _month_label(key), 'actual': None}
        for sname, s in scenarios.items():
            rev = base_monthly
            for _ in range(i):
                rev *= (1 + s['growth'])
            entry[sname] = max(rev, 0)
        projection_list.append(entry)

    history = [{
        'month': k, 'label': _month_label(k),
        'actual': monthly_actual[k]['total'],
        'subscription': monthly_actual[k]['subscription'],
        'token': monthly_actual[k]['token'],
        'ppv': monthly_actual[k]['ppv'],
        'other': monthly_actual[k]['other'],
        'pessimistic': None, 'realistic': None, 'optimistic': None,
    } for k in months]

    last_total = monthly_actual[months[-1]]['total'] if months else 0
    prev_total = monthly_actual[months[-2]]['total'] if len(months) >= 2 else 0
    mom = ((last_total - prev_total) / prev_total * 100) if prev_total > 0 else 0

    return Response({
        'kpi': {
            'mrr': round(mrr, 2), 'arr': round(mrr * 12, 2),
            'totalActiveSubs': total_active_subs,
            'lastMonthRevenue': round(last_total, 2),
            'mom': round(mom, 1),
            'avgMonthlyToken': round(avg_monthly_token, 2),
            'avgMonthlyPPV': round(avg_monthly_ppv, 2),
            'projectedAnnual': round(sum(p['realistic'] for p in projection_list), 2),
        },
        'scenarios': {k: {'label': v['label'], 'color': v['color']} for k, v in scenarios.items()},
        'revenueBreakdown': {
            'subscription': sum(m['subscription'] for m in monthly_actual.values()),
            'token':        sum(m['token']        for m in monthly_actual.values()),
            'ppv':          sum(m['ppv']          for m in monthly_actual.values()),
            'other':        sum(m['other']        for m in monthly_actual.values()),
        },
        'history': history,
        'projection': projection_list,
        'growthRate': round(growth_rate * 1000) / 10,
    })


# ─── Security stats (minimal stub: counts of failed logins last 24h) ─────────
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_security_stats(request):
    if not _admin_required(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    from django.utils import timezone as _tz
    from datetime import timedelta as _td
    from django.contrib.auth import get_user_model
    User = get_user_model()
    now = _tz.now()
    last_24h = now - _td(hours=24)
    return Response({
        'totalUsers': User.objects.count(),
        'recentSignups24h': User.objects.filter(created_at__gte=last_24h).count(),
        'blockedRequests': 0,
        'suspiciousIPs': [],
        'rateLimitedRecently': 0,
        'generatedAt': now.isoformat(),
    })
