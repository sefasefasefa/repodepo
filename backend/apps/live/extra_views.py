import secrets
from datetime import timedelta
from django.utils import timezone
from django.db.models import F
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import LiveStream, LiveChatMessage, LiveViewer, LivePollVote
from .views import _fmt_stream


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([AllowAny])
def record_view(request, stream_id):
    try:
        stream = LiveStream.objects.get(id=stream_id)
    except LiveStream.DoesNotExist:
        return Response({'ok': False})
    if stream.status != 'live':
        return Response({'ok': False})

    me = request.user if request.user.is_authenticated else None
    session_token = (request.data or {}).get('sessionToken') or f'anon_{secrets.token_hex(8)}'

    if me:
        viewer, created = LiveViewer.objects.get_or_create(
            stream=stream, user=me, defaults={'session_token': session_token}
        )
        if not created:
            viewer.save()  # touches last_seen_at via auto_now
    else:
        viewer, created = LiveViewer.objects.get_or_create(
            stream=stream, session_token=session_token, defaults={}
        )
        if not created:
            viewer.save()

    cutoff = timezone.now() - timedelta(seconds=30)
    viewer_count = LiveViewer.objects.filter(stream=stream, last_seen_at__gt=cutoff).count()

    stream.viewer_count = viewer_count
    if viewer_count > stream.peak_viewers:
        stream.peak_viewers = viewer_count
    stream.total_views += 1
    stream.save(update_fields=['viewer_count', 'peak_viewers', 'total_views'])

    return Response({'ok': True, 'sessionToken': session_token, 'viewerCount': viewer_count})


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def poll_vote(request, stream_id):
    try:
        stream = LiveStream.objects.get(id=stream_id)
    except LiveStream.DoesNotExist:
        return Response({'error': 'Yayın bulunamadı'}, status=404)
    if not stream.poll_options:
        return Response({'error': 'Anket bulunamadı'}, status=404)

    option_index = (request.data or {}).get('optionIndex')
    session_token = (request.data or {}).get('sessionToken')
    if not isinstance(option_index, int) or option_index < 0 or option_index >= len(stream.poll_options):
        return Response({'error': 'Geçersiz seçenek'}, status=400)

    LivePollVote.objects.filter(stream=stream, user=request.user).delete()
    LivePollVote.objects.create(
        stream=stream, user=request.user,
        session_token=session_token, option_index=option_index,
    )

    counts = [0] * len(stream.poll_options)
    for v in LivePollVote.objects.filter(stream=stream):
        if 0 <= v.option_index < len(counts):
            counts[v.option_index] += 1
    stream.poll_votes = counts
    stream.save(update_fields=['poll_votes'])
    return Response({'pollVotes': counts})


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def update_goal(request, stream_id):
    try:
        stream = LiveStream.objects.get(id=stream_id)
    except LiveStream.DoesNotExist:
        return Response({'error': 'Yayın bulunamadı'}, status=404)
    if stream.user_id != request.user.id and getattr(request.user, 'role', '') != 'admin':
        return Response({'error': 'Yetkisiz'}, status=403)

    data = request.data or {}
    if 'goalTitle' in data:
        stream.goal_title = data['goalTitle']
    if 'goalTarget' in data:
        stream.goal_target = data['goalTarget']
    if 'goalProgress' in data:
        stream.goal_progress = data['goalProgress']
    stream.save()
    return Response({'stream': _fmt_stream(stream)})


@api_view(['DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def delete_chat_message(request, stream_id, msg_id):
    try:
        stream = LiveStream.objects.get(id=stream_id)
    except LiveStream.DoesNotExist:
        return Response({'error': 'Yayın bulunamadı'}, status=404)
    if stream.user_id != request.user.id and getattr(request.user, 'role', '') != 'admin':
        return Response({'error': 'Yetkisiz'}, status=403)
    LiveChatMessage.objects.filter(id=msg_id, stream=stream).update(is_deleted=True)
    return Response({'ok': True})


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def my_streams(request):
    streams = LiveStream.objects.filter(user=request.user).order_by('-created_at')[:20]
    return Response({'streams': [_fmt_stream(s) for s in streams]})


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def rotate_stream_key(request, stream_id):
    try:
        stream = LiveStream.objects.get(id=stream_id)
    except LiveStream.DoesNotExist:
        return Response({'error': 'Yayın bulunamadı'}, status=404)
    if stream.user_id != request.user.id:
        return Response({'error': 'Yetkisiz'}, status=403)
    if stream.status == 'live':
        return Response({'error': 'Canlı yayında key değiştirilemez'}, status=400)
    stream.stream_key = f'sk_{secrets.token_hex(16)}'
    stream.save(update_fields=['stream_key'])
    return Response({'stream': _fmt_stream(stream)})
