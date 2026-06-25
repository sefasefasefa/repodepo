from django.utils import timezone
from django.db.models import Count, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.videos.models import Video, VideoReport


def _is_admin(u):
    return u.is_authenticated and u.role in ('admin', 'moderator')


def _video_to_dict(v):
    rep_count = v.reports.count() if hasattr(v, 'reports') else 0
    return {
        'id': v.id,
        'title': v.title,
        'description': (v.description or '')[:240],
        'thumbnailUrl': v.thumbnail_url,
        'videoUrl': v.video_url,
        'duration': v.duration,
        'viewCount': v.view_count,
        'isPublished': v.is_published,
        'moderationStatus': v.moderation_status,
        'moderationNote': v.moderation_note,
        'moderatedAt': v.moderated_at.isoformat() if v.moderated_at else None,
        'createdAt': v.created_at.isoformat(),
        'reportCount': rep_count,
        'creator': {
            'id': v.creator.id, 'username': v.creator.username,
            'displayName': v.creator.display_name, 'avatarUrl': v.creator.avatar_url,
        } if v.creator else None,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def moderation_queue(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    status = request.query_params.get('status', 'pending')
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 100)
    offset = (page - 1) * limit

    qs = Video.objects.select_related('creator')
    if status == 'reported':
        qs = qs.annotate(rc=Count('reports', filter=Q(reports__status='pending'))).filter(rc__gt=0)
    elif status in ('pending', 'approved', 'rejected', 'flagged'):
        qs = qs.filter(moderation_status=status)

    total = qs.count()
    items = list(qs.order_by('-created_at')[offset:offset + limit])
    return Response({
        'videos': [_video_to_dict(v) for v in items],
        'total': total, 'page': page, 'limit': limit,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def moderation_stats(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    counts = Video.objects.values('moderation_status').annotate(n=Count('id'))
    out = {'pending': 0, 'approved': 0, 'rejected': 0, 'flagged': 0}
    for c in counts:
        if c['moderation_status'] in out:
            out[c['moderation_status']] = c['n']
    out['reported'] = Video.objects.filter(reports__status='pending').distinct().count()
    return Response(out)


def _moderate(request, video_id, new_status, default_publish):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    try:
        v = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video bulunamadı'}, status=404)
    note = request.data.get('note', '')
    v.moderation_status = new_status
    v.moderation_note = note
    v.moderated_at = timezone.now()
    v.moderated_by = request.user
    if default_publish is not None:
        v.is_published = default_publish
    v.save()
    # Auto-resolve pending reports tied to this video when admin takes action
    VideoReport.objects.filter(video=v, status='pending').update(
        status='resolved' if new_status != 'approved' else 'dismissed'
    )
    return Response({'video': _video_to_dict(v)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def moderation_approve(request, video_id):
    return _moderate(request, video_id, 'approved', True)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def moderation_reject(request, video_id):
    return _moderate(request, video_id, 'rejected', False)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def moderation_flag(request, video_id):
    return _moderate(request, video_id, 'flagged', False)
