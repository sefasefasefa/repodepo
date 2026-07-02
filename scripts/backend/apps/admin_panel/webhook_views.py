"""
Modern Webhook Management API Views
====================================
Endpoints:
  GET  /api/webhooks/admin/endpoints          — list all endpoints
  POST /api/webhooks/admin/endpoints          — create endpoint
  GET  /api/webhooks/admin/endpoints/<id>     — get endpoint detail
  PUT  /api/webhooks/admin/endpoints/<id>     — update endpoint
  DELETE /api/webhooks/admin/endpoints/<id>   — delete endpoint
  POST /api/webhooks/admin/endpoints/<id>/test    — test fire
  POST /api/webhooks/admin/endpoints/<id>/toggle  — enable/disable
  GET  /api/webhooks/admin/deliveries         — delivery history (filterable)
  GET  /api/webhooks/admin/deliveries/<id>    — delivery detail
  POST /api/webhooks/admin/deliveries/<id>/retry  — retry failed delivery
  GET  /api/webhooks/admin/stats              — aggregate stats
  POST /api/webhooks/admin/fire              — manually fire event
  GET/PUT /api/webhooks/admin/global         — global on/off toggle
"""

import threading
from django.utils import timezone
from django.db.models import Count, Q, Avg
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import WebhookEndpoint, WebhookDelivery, WebhookSettings
from . import webhook_service as svc

PERM = [IsAuthenticated]


def _is_admin(user):
    return user.is_authenticated and user.role in ('admin', 'moderator')


def _ep_dict(ep: WebhookEndpoint) -> dict:
    return {
        'id': ep.id,
        'name': ep.name,
        'platform': ep.platform,
        'url': ep.url,
        'secret': '***' if ep.secret else '',
        'hasSecret': bool(ep.secret),
        'events': ep.events,
        'isEnabled': ep.is_enabled,
        'status': ep.status,
        'totalDeliveries': ep.total_deliveries,
        'successDeliveries': ep.success_deliveries,
        'successRate': ep.success_rate,
        'lastTriggeredAt': ep.last_triggered_at.isoformat() if ep.last_triggered_at else None,
        'lastStatusCode': ep.last_status_code,
        'maxRetries': ep.max_retries,
        'timeoutSecs': ep.timeout_secs,
        'createdAt': ep.created_at.isoformat(),
        'updatedAt': ep.updated_at.isoformat(),
    }


def _delivery_dict(d: WebhookDelivery) -> dict:
    return {
        'id': d.id,
        'endpointId': d.endpoint_id,
        'endpointName': d.endpoint.name if hasattr(d, '_endpoint_cache') or d.endpoint_id else '—',
        'event': d.event,
        'status': d.status,
        'attempt': d.attempt,
        'maxAttempts': d.max_attempts,
        'responseStatus': d.response_status,
        'responseTimeMs': d.response_time_ms,
        'error': d.error,
        'triggeredAt': d.triggered_at.isoformat(),
        'deliveredAt': d.delivered_at.isoformat() if d.delivered_at else None,
    }


# ── Endpoints CRUD ─────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes(PERM)
def endpoint_list(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)

    if request.method == 'GET':
        eps = WebhookEndpoint.objects.all()
        return Response({'endpoints': [_ep_dict(e) for e in eps]})

    # POST — create
    d = request.data
    if not d.get('url'):
        return Response({'error': 'URL gerekli'}, status=400)
    ep = WebhookEndpoint.objects.create(
        name=d.get('name', 'Yeni Webhook'),
        platform=d.get('platform', 'custom'),
        url=d['url'],
        secret=d.get('secret', ''),
        events=d.get('events', []),
        is_enabled=d.get('isEnabled', True),
        max_retries=int(d.get('maxRetries', 3)),
        timeout_secs=int(d.get('timeoutSecs', 10)),
    )
    return Response({'endpoint': _ep_dict(ep)}, status=201)


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes(PERM)
def endpoint_detail(request, ep_id):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    try:
        ep = WebhookEndpoint.objects.get(pk=ep_id)
    except WebhookEndpoint.DoesNotExist:
        return Response({'error': 'Bulunamadı'}, status=404)

    if request.method == 'GET':
        return Response({'endpoint': _ep_dict(ep)})

    if request.method == 'DELETE':
        ep.delete()
        return Response({'ok': True})

    # PUT — update
    d = request.data
    if 'name' in d:
        ep.name = d['name']
    if 'platform' in d:
        ep.platform = d['platform']
    if 'url' in d:
        ep.url = d['url']
    if 'secret' in d and d['secret'] != '***':
        ep.secret = d['secret']
    if 'events' in d:
        ep.events = d['events']
    if 'isEnabled' in d:
        ep.is_enabled = bool(d['isEnabled'])
    if 'maxRetries' in d:
        ep.max_retries = int(d['maxRetries'])
    if 'timeoutSecs' in d:
        ep.timeout_secs = int(d['timeoutSecs'])
    ep.save()
    return Response({'endpoint': _ep_dict(ep)})


@api_view(['POST'])
@permission_classes(PERM)
def endpoint_toggle(request, ep_id):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    try:
        ep = WebhookEndpoint.objects.get(pk=ep_id)
    except WebhookEndpoint.DoesNotExist:
        return Response({'error': 'Bulunamadı'}, status=404)
    ep.is_enabled = not ep.is_enabled
    ep.save(update_fields=['is_enabled'])
    return Response({'isEnabled': ep.is_enabled})


@api_view(['POST'])
@permission_classes(PERM)
def endpoint_test(request, ep_id):
    """Fire a test event to a specific endpoint synchronously and return delivery result."""
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    try:
        ep = WebhookEndpoint.objects.get(pk=ep_id)
    except WebhookEndpoint.DoesNotExist:
        return Response({'error': 'Bulunamadı'}, status=404)

    event = request.data.get('event', 'video.created')
    payload = request.data.get('payload') or {
        'id': 999,
        'title': 'Test Video — Prnhbbbb',
        'creator': request.user.display_name or request.user.username,
        'timestamp': svc._now_iso(),
        'note': '🧪 Bu bir test webhook gönderimdir.',
    }
    payload['timestamp'] = svc._now_iso()

    delivery = svc.dispatch(ep, event, payload)
    ep.refresh_from_db()
    return Response({
        'delivery': _delivery_dict(delivery),
        'endpoint': _ep_dict(ep),
    })


# ── Delivery History ───────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes(PERM)
def delivery_list(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)

    qs = WebhookDelivery.objects.select_related('endpoint').order_by('-triggered_at')

    ep_id = request.query_params.get('endpoint')
    if ep_id:
        qs = qs.filter(endpoint_id=ep_id)

    event = request.query_params.get('event')
    if event:
        qs = qs.filter(event=event)

    status = request.query_params.get('status')
    if status:
        qs = qs.filter(status=status)

    limit = min(int(request.query_params.get('limit', 50)), 200)
    page  = max(int(request.query_params.get('page', 1)), 1)
    offset = (page - 1) * limit
    total = qs.count()
    deliveries = qs[offset:offset + limit]

    def dd(d):
        r = _delivery_dict(d)
        r['endpointName'] = d.endpoint.name
        r['platform']     = d.endpoint.platform
        return r

    return Response({
        'deliveries': [dd(d) for d in deliveries],
        'total': total,
        'page': page,
        'limit': limit,
        'pages': (total + limit - 1) // limit,
    })


@api_view(['GET'])
@permission_classes(PERM)
def delivery_detail(request, delivery_id):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    try:
        d = WebhookDelivery.objects.select_related('endpoint').get(pk=delivery_id)
    except WebhookDelivery.DoesNotExist:
        return Response({'error': 'Bulunamadı'}, status=404)

    result = _delivery_dict(d)
    result['endpointName']    = d.endpoint.name
    result['platform']        = d.endpoint.platform
    result['payload']         = d.payload
    result['requestBody']     = d.request_body
    result['requestHeaders']  = d.request_headers
    result['responseBody']    = d.response_body
    return Response({'delivery': result})


@api_view(['POST'])
@permission_classes(PERM)
def delivery_retry(request, delivery_id):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    try:
        d = WebhookDelivery.objects.select_related('endpoint').get(pk=delivery_id)
    except WebhookDelivery.DoesNotExist:
        return Response({'error': 'Bulunamadı'}, status=404)

    if d.status == 'success':
        return Response({'error': 'Zaten başarılı, tekrar göndermeye gerek yok'}, status=400)

    # Reset and retry synchronously
    d.attempt = 1
    d.status = 'pending'
    d.error = ''
    d.save(update_fields=['attempt', 'status', 'error'])

    delivery = svc.dispatch(d.endpoint, d.event, d.payload, delivery_obj=d)
    d.endpoint.refresh_from_db()
    result = _delivery_dict(delivery)
    result['endpointName'] = delivery.endpoint.name
    result['platform']     = delivery.endpoint.platform
    return Response({'delivery': result})


# ── Stats ─────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes(PERM)
def webhook_stats(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)

    endpoints = WebhookEndpoint.objects.all()
    total_ep  = endpoints.count()
    active_ep = endpoints.filter(is_enabled=True).count()

    deliveries = WebhookDelivery.objects.all()
    total_del  = deliveries.count()
    success_del = deliveries.filter(status='success').count()
    failed_del  = deliveries.filter(status='failed').count()
    pending_del = deliveries.filter(status__in=['pending', 'retrying']).count()
    avg_ms = deliveries.filter(status='success').aggregate(a=Avg('response_time_ms'))['a']

    # Events breakdown (top 10 by count)
    event_counts = (
        WebhookDelivery.objects
        .values('event')
        .annotate(count=Count('id'))
        .order_by('-count')[:10]
    )

    # Per-platform stats
    platform_stats = []
    for ep in endpoints:
        platform_stats.append({
            'id': ep.id,
            'name': ep.name,
            'platform': ep.platform,
            'isEnabled': ep.is_enabled,
            'status': ep.status,
            'totalDeliveries': ep.total_deliveries,
            'successRate': ep.success_rate,
            'lastTriggeredAt': ep.last_triggered_at.isoformat() if ep.last_triggered_at else None,
        })

    # Recent failures
    recent_failures = []
    for d in deliveries.filter(status='failed').select_related('endpoint').order_by('-triggered_at')[:5]:
        recent_failures.append({
            'id': d.id,
            'event': d.event,
            'endpointName': d.endpoint.name,
            'platform': d.endpoint.platform,
            'responseStatus': d.response_status,
            'error': d.error[:200] if d.error else '',
            'triggeredAt': d.triggered_at.isoformat(),
        })

    global_enabled = False
    try:
        ws = WebhookSettings.objects.get(id=1)
        global_enabled = ws.is_enabled
    except WebhookSettings.DoesNotExist:
        pass

    return Response({
        'globalEnabled': global_enabled,
        'endpoints': {
            'total': total_ep,
            'active': active_ep,
            'failing': endpoints.filter(status='failing').count(),
        },
        'deliveries': {
            'total': total_del,
            'success': success_del,
            'failed': failed_del,
            'pending': pending_del,
            'successRate': round(success_del / total_del * 100, 1) if total_del else None,
            'avgResponseMs': round(avg_ms) if avg_ms else None,
        },
        'topEvents': list(event_counts),
        'endpointStats': platform_stats,
        'recentFailures': recent_failures,
    })


# ── Manual fire & global toggle ──────────────────────────────────────────────

@api_view(['POST'])
@permission_classes(PERM)
def manual_fire(request):
    """Manually fire an event to all (or one) endpoint(s)."""
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)

    event   = request.data.get('event', 'video.created')
    payload = request.data.get('payload', {})
    ep_id   = request.data.get('endpointId')  # optional

    payload['timestamp'] = svc._now_iso()

    if ep_id:
        try:
            ep = WebhookEndpoint.objects.get(pk=ep_id)
        except WebhookEndpoint.DoesNotExist:
            return Response({'error': 'Endpoint bulunamadı'}, status=404)
        delivery = svc.dispatch(ep, event, payload)
        return Response({'deliveries': [_delivery_dict(delivery)]})

    # Fire to all in a background thread
    threading.Thread(target=svc.fire_event, args=(event, payload), daemon=True).start()
    return Response({'ok': True, 'message': f'{event} tüm aktif endpointlere gönderildi (arka planda)'})


@api_view(['GET', 'PUT'])
@permission_classes(PERM)
def global_toggle(request):
    """Global webhook system enable/disable."""
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)

    ws, _ = WebhookSettings.objects.get_or_create(id=1)
    if request.method == 'PUT':
        ws.is_enabled = bool(request.data.get('isEnabled', ws.is_enabled))
        ws.save(update_fields=['is_enabled'])
    return Response({'isEnabled': ws.is_enabled})
