import secrets
import json
import time
from django.utils import timezone
from django.db.models import F
from django.http import StreamingHttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .models import LiveStream, LiveChatMessage, LiveViewer, LivePollVote
from apps.accounts.views import format_user


def _fmt_stream(s):
    return {
        'id': s.id,
        'userId': s.user_id,
        'creator': format_user(s.user),
        'title': s.title,
        'description': s.description,
        'thumbnail': s.thumbnail,
        'status': s.status,
        'streamKey': s.stream_key,
        'hlsUrl': s.hls_url,
        'chatEnabled': s.chat_enabled,
        'viewerCount': s.viewer_count,
        'peakViewers': s.peak_viewers,
        'startedAt': s.started_at.isoformat() if s.started_at else None,
        'createdAt': s.created_at.isoformat(),
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def list_live_streams(request):
    streams = LiveStream.objects.filter(status='live').select_related('user').order_by('-viewer_count')
    return Response({'streams': [_fmt_stream(s) for s in streams]})


@api_view(['GET'])
@permission_classes([AllowAny])
def live_history(request):
    streams = LiveStream.objects.filter(status='ended').select_related('user').order_by('-ended_at')[:20]
    return Response({'streams': [_fmt_stream(s) for s in streams]})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_live_stream(request, stream_id):
    try:
        s = LiveStream.objects.select_related('user').get(id=stream_id)
    except LiveStream.DoesNotExist:
        return Response({'error': 'Stream not found'}, status=404)
    return Response(_fmt_stream(s))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_stream(request):
    user = request.user
    if user.role not in ('creator', 'admin'):
        return Response({'error': 'Creator hesabı gerekli'}, status=403)
    existing = LiveStream.objects.filter(user=user, status__in=['idle', 'live']).first()
    if existing:
        return Response({'stream': _fmt_stream(existing)})
    stream = LiveStream.objects.create(
        user=user,
        title=request.data.get('title', 'Canlı Yayın'),
        description=request.data.get('description', ''),
        stream_key=secrets.token_hex(16),
    )
    return Response({'stream': _fmt_stream(stream)}, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_stream(request, stream_id):
    try:
        stream = LiveStream.objects.get(id=stream_id, user=request.user)
    except LiveStream.DoesNotExist:
        return Response({'error': 'Stream not found'}, status=404)
    stream.status = 'live'
    stream.started_at = timezone.now()
    stream.save()
    return Response(_fmt_stream(stream))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def end_stream(request, stream_id):
    try:
        stream = LiveStream.objects.get(id=stream_id, user=request.user)
    except LiveStream.DoesNotExist:
        return Response({'error': 'Stream not found'}, status=404)
    stream.status = 'ended'
    stream.ended_at = timezone.now()
    stream.save()
    return Response(_fmt_stream(stream))


@api_view(['GET'])
@permission_classes([AllowAny])
def get_chat_messages(request, stream_id):
    limit = min(int(request.query_params.get('limit', 50)), 100)
    messages = LiveChatMessage.objects.filter(
        stream_id=stream_id, is_deleted=False
    ).select_related('user').order_by('-created_at')[:limit]
    return Response({'messages': [{
        'id': m.id,
        'user': format_user(m.user),
        'message': m.message,
        'createdAt': m.created_at.isoformat(),
    } for m in reversed(list(messages))]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_chat_message(request, stream_id):
    try:
        stream = LiveStream.objects.get(id=stream_id, status='live')
    except LiveStream.DoesNotExist:
        return Response({'error': 'Stream not live'}, status=404)
    if not stream.chat_enabled:
        return Response({'error': 'Chat disabled'}, status=403)
    msg_content = request.data.get('message', '').strip()
    if not msg_content:
        return Response({'error': 'Message required'}, status=400)
    msg = LiveChatMessage.objects.create(stream=stream, user=request.user, message=msg_content)
    return Response({
        'id': msg.id,
        'user': format_user(request.user),
        'message': msg.message,
        'createdAt': msg.created_at.isoformat(),
    }, status=201)


def live_chat_sse(request, stream_id):
    """
    Server-Sent Events stream for live chat messages.
    Clients connect and receive new chat messages in real time.
    URL: GET /api/live/<stream_id>/chat/stream
    """
    def event_generator():
        last_id = 0
        # Send initial keepalive
        yield 'event: connected\ndata: {"streamId": ' + str(stream_id) + '}\n\n'

        try:
            stream = LiveStream.objects.get(id=stream_id)
        except LiveStream.DoesNotExist:
            yield 'event: error\ndata: {"error": "Stream not found"}\n\n'
            return

        while stream.status in ('idle', 'live'):
            new_msgs = LiveChatMessage.objects.filter(
                stream_id=stream_id, id__gt=last_id, is_deleted=False
            ).select_related('user').order_by('id')[:20]

            for msg in new_msgs:
                last_id = msg.id
                data = json.dumps({
                    'id': msg.id,
                    'user': format_user(msg.user),
                    'message': msg.message,
                    'createdAt': msg.created_at.isoformat(),
                })
                yield f'event: message\ndata: {data}\n\n'

            # Refresh stream status
            try:
                stream.refresh_from_db(fields=['status', 'viewer_count'])
            except Exception:
                break

            # Heartbeat every cycle to detect disconnected clients
            yield ': heartbeat\n\n'
            time.sleep(2)

        yield 'event: ended\ndata: {"streamId": ' + str(stream_id) + '}\n\n'

    response = StreamingHttpResponse(event_generator(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    response['Access-Control-Allow-Origin'] = '*'
    return response


def live_stream_sse(request, stream_id):
    """
    Server-Sent Events stream for live stream viewer count / status updates.
    URL: GET /api/live/<stream_id>/stream
    """
    def event_generator():
        yield 'event: connected\ndata: {"streamId": ' + str(stream_id) + '}\n\n'
        try:
            stream = LiveStream.objects.get(id=stream_id)
        except LiveStream.DoesNotExist:
            yield 'event: error\ndata: {"error": "Stream not found"}\n\n'
            return

        while stream.status in ('idle', 'live'):
            try:
                stream.refresh_from_db()
            except Exception:
                break
            data = json.dumps({
                'status': stream.status,
                'viewerCount': stream.viewer_count,
                'peakViewers': stream.peak_viewers,
            })
            yield f'event: update\ndata: {data}\n\n'
            yield ': heartbeat\n\n'
            time.sleep(5)

        yield 'event: ended\ndata: {"status": "ended"}\n\n'

    response = StreamingHttpResponse(event_generator(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    response['Access-Control-Allow-Origin'] = '*'
    return response
