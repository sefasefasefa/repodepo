"""Premium-gated video downloads."""
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import Video, VideoDownload
from apps.subscriptions.models import UserSubscription
from .utils import resolve_video as _resolve_video


def _has_premium(user):
    if user.role in ('admin', 'creator', 'moderator'):
        return True
    now = timezone.now()
    return UserSubscription.objects.filter(
        user=user, status='active', current_period_end__gt=now,
    ).exists()


def _fmt(d):
    v = d.video
    creator = v.creator
    return {
        'id': d.id, 'videoId': v.id,
        'title': v.title,
        'thumbnailUrl': v.thumbnail_url,
        'videoUrl': v.video_url,
        'creatorName': creator.display_name or creator.username,
        'quality': d.quality,
        'downloadedAt': d.created_at.isoformat() if d.created_at else None,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_downloads(request):
    rows = (VideoDownload.objects.filter(user=request.user)
            .select_related('video', 'video__creator').order_by('-created_at'))
    return Response({'downloads': [_fmt(d) for d in rows]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_download(request, video_id):
    if not _has_premium(request.user):
        return Response({'error': 'Bu özellik yalnızca Premium üyelere açıktır'}, status=403)
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video bulunamadı'}, status=404)
    quality = request.data.get('quality') or '720p'
    row, _ = VideoDownload.objects.update_or_create(
        user=request.user, video=video,
        defaults={'quality': quality},
    )
    return Response({'download': _fmt(row), 'videoUrl': video.video_url})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_download(request, video_id):
    video = _resolve_video(video_id)
    if video:
        VideoDownload.objects.filter(user=request.user, video=video).delete()
    return Response({'ok': True})


@api_view(['GET'])
@permission_classes([AllowAny])
def check_download(request, video_id):
    if not request.user.is_authenticated:
        return Response({'downloaded': False, 'isPremium': False})
    is_prem = _has_premium(request.user)
    video = _resolve_video(video_id)
    downloaded = VideoDownload.objects.filter(user=request.user, video=video).exists() if video else False
    return Response({'downloaded': downloaded, 'isPremium': is_prem})
