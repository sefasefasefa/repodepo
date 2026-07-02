import json
import time
from django.db.models import F
from django.http import StreamingHttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Notification


def _fmt_notif(n):
    return {
        'id': n.id,
        'type': n.type,
        'title': n.title,
        'message': n.message,
        'isRead': n.is_read,
        'actionUrl': n.action_url,
        'actorId': n.actor_id,
        'createdAt': n.created_at.isoformat(),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_notifications(request):
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    notifs = Notification.objects.filter(user=request.user).select_related('actor').order_by('-created_at')
    total = notifs.count()
    items = list(notifs[offset:offset + limit])
    return Response({
        'notifications': [_fmt_notif(n) for n in items],
        'total': total,
        'unreadCount': Notification.objects.filter(user=request.user, is_read=False).count(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_read(request, notification_id):
    Notification.objects.filter(id=notification_id, user=request.user).update(is_read=True)
    return Response({'message': 'Marked as read'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_read(request):
    Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
    return Response({'message': 'All marked as read'})


def _resolve_sse_user(request):
    """
    Authenticate an SSE request using DRF auth classes so that Bearer
    (session-token) and JWT Authorization headers both work.

    StreamingHttpResponse cannot go through @api_view because DRF would
    buffer the entire response.  We therefore run DRF auth manually here
    and return (user, error_response).
    """
    from rest_framework.request import Request as DRFRequest
    from rest_framework.parsers import JSONParser
    from apps.accounts.authentication import BearerTokenAuthentication
    from rest_framework_simplejwt.authentication import JWTAuthentication

    # EventSource (browser SSE) cannot set custom headers, so the client passes
    # the JWT as ?token=… in the query string. Inject it as the Authorization
    # header so the standard DRF auth classes can validate it.
    if 'HTTP_AUTHORIZATION' not in request.META:
        qtoken = request.GET.get('token') or request.GET.get('access_token')
        if qtoken:
            request.META['HTTP_AUTHORIZATION'] = f'Bearer {qtoken}'

    # Build a lightweight DRF Request wrapper around the Django HttpRequest.
    drf_request = DRFRequest(request, parsers=[JSONParser()],
                             authenticators=[BearerTokenAuthentication(), JWTAuthentication()])
    try:
        user = drf_request.user
    except Exception:
        user = None

    if not user or not user.is_authenticated:
        err = StreamingHttpResponse(
            iter(['event: error\ndata: {"error": "Authentication required"}\n\n']),
            content_type='text/event-stream',
            status=401,
        )
        err['Cache-Control'] = 'no-cache'
        return None, err

    return user, None


def notification_stream(request):
    """
    GET /api/notifications/stream
    Server-Sent Events stream for real-time notification delivery.
    Accepts Bearer <session_token> or Bearer <JWT access token>.
    """
    user, err = _resolve_sse_user(request)
    if err is not None:
        return err

    def event_stream():
        last_id = 0
        # Send initial keepalive so the client knows the connection is live.
        yield 'event: connected\ndata: {"userId": ' + str(user.id) + '}\n\n'
        while True:
            new_notifs = Notification.objects.filter(
                user=user, id__gt=last_id
            ).order_by('id')[:10]
            for n in new_notifs:
                last_id = n.id
                data = json.dumps(_fmt_notif(n))
                yield f'event: notification\ndata: {data}\n\n'
            yield ': heartbeat\n\n'
            time.sleep(5)

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response
