import uuid
from collections import defaultdict
from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.videos.models import Video
from apps.videos.views import enrich_video
from .models import Device, DeviceInteraction

KIND_WEIGHTS = {
    'view': 1.0, 'watch': 0.5, 'complete': 3.0,
    'like': 5.0, 'bookmark': 4.0, 'share': 4.0,
}


def _is_admin(u):
    return u.is_authenticated and getattr(u, 'role', '') in ('admin', 'moderator')


def _get_or_create_device(data, user=None):
    device_id = (data.get('deviceId') or '').strip()
    fp = (data.get('fingerprint') or '').strip()
    device = None
    if device_id:
        device = Device.objects.filter(device_id=device_id).first()
    if not device and fp:
        # Same physical browser but localStorage was wiped → recover via fp.
        device = Device.objects.filter(fingerprint=fp).order_by('-last_seen_at').first()
    if not device:
        device = Device(device_id=str(uuid.uuid4()))
    # Update mutable attrs
    device.fingerprint = fp or device.fingerprint
    device.user_agent = (data.get('userAgent') or device.user_agent or '')[:2000]
    device.screen = (data.get('screen') or device.screen or '')[:32]
    device.timezone = (data.get('tz') or device.timezone or '')[:64]
    device.lang = (data.get('lang') or device.lang or '')[:16]
    device.platform = (data.get('platform') or device.platform or '')[:64]
    if user and getattr(user, 'is_authenticated', False):
        device.user = user
    device.save()
    return device


@api_view(['POST'])
@permission_classes([AllowAny])
def identify(request):
    """Identify or create a device. Returns the canonical deviceId."""
    user = request.user if getattr(request.user, 'is_authenticated', False) else None
    device = _get_or_create_device(request.data, user=user)
    return Response({
        'deviceId': device.device_id,
        'interactionCount': device.interaction_count,
        'linkedUser': device.user_id,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def record_event(request):
    """Record a video interaction for this device.
    Body: { deviceId, videoId, kind, seconds?, weight? }"""
    device_id = request.data.get('deviceId') or ''
    video_id = request.data.get('videoId')
    kind = request.data.get('kind') or 'view'
    if kind not in KIND_WEIGHTS:
        return Response({'error': 'invalid kind'}, status=400)
    if not device_id or not video_id:
        return Response({'error': 'deviceId and videoId required'}, status=400)
    try:
        device = Device.objects.get(device_id=device_id)
    except Device.DoesNotExist:
        return Response({'error': 'unknown device'}, status=404)
    if not Video.objects.filter(id=video_id).exists():
        return Response({'error': 'video not found'}, status=404)
    seconds = int(request.data.get('seconds') or 0)
    base = KIND_WEIGHTS[kind]
    weight = float(request.data.get('weight') or (max(seconds, 0) / 30.0 if kind == 'watch' else base))
    DeviceInteraction.objects.create(
        device=device, video_id=video_id, kind=kind, weight=weight, seconds=seconds,
    )
    Device.objects.filter(id=device.id).update(interaction_count=device.interaction_count + 1)
    # Auto-link to current user if we now know who they are
    if not device.user_id and getattr(request.user, 'is_authenticated', False):
        Device.objects.filter(id=device.id).update(user_id=request.user.id)
    return Response({'ok': True})


@api_view(['GET'])
@permission_classes([AllowAny])
def recommendations(request):
    """Return videos personalised to this device.
    Query: deviceId, limit (<=24)"""
    device_id = request.query_params.get('deviceId') or ''
    limit = min(int(request.query_params.get('limit', 12)), 24)
    device = Device.objects.filter(device_id=device_id).first() if device_id else None

    # Cold start → newest most-viewed published+approved videos
    if not device or device.interaction_count == 0:
        qs = (Video.objects
              .filter(is_published=True, moderation_status='approved')
              .select_related('creator', 'category')
              .order_by('-view_count', '-created_at')[:limit])
        return Response({
            'videos': [enrich_video(v, request.user if request.user.is_authenticated else None) for v in qs],
            'source': 'cold_start',
        })

    # Aggregate weights per category from the last 200 interactions
    recent = list(
        DeviceInteraction.objects
        .filter(device=device)
        .select_related('video', 'video__category')
        .order_by('-created_at')[:200]
    )
    cat_score: dict[int, float] = defaultdict(float)
    creator_score: dict[int, float] = defaultdict(float)
    seen_ids: set[int] = set()
    for it in recent:
        seen_ids.add(it.video_id)
        if it.video.category_id:
            cat_score[it.video.category_id] += it.weight
        if it.video.creator_id:
            creator_score[it.video.creator_id] += it.weight * 0.6

    if not cat_score and not creator_score:
        qs = (Video.objects
              .filter(is_published=True, moderation_status='approved')
              .exclude(id__in=seen_ids)
              .select_related('creator', 'category')
              .order_by('-view_count')[:limit])
        return Response({
            'videos': [enrich_video(v, request.user if request.user.is_authenticated else None) for v in qs],
            'source': 'popular_fallback',
        })

    # Candidate pool: unseen videos in the top categories or by favourite creators
    top_cats = sorted(cat_score, key=cat_score.get, reverse=True)[:6]
    top_creators = sorted(creator_score, key=creator_score.get, reverse=True)[:8]

    pool = (Video.objects
            .filter(is_published=True, moderation_status='approved')
            .exclude(id__in=seen_ids)
            .select_related('creator', 'category'))
    from django.db.models import Q
    pool = pool.filter(Q(category_id__in=top_cats) | Q(creator_id__in=top_creators))
    pool = pool.order_by('-view_count', '-like_count')[:max(limit * 4, 40)]

    # Score and sort
    scored = []
    max_views = max((v.view_count for v in pool), default=1) or 1
    for v in pool:
        s = 0.0
        if v.category_id and v.category_id in cat_score:
            s += cat_score[v.category_id]
        if v.creator_id and v.creator_id in creator_score:
            s += creator_score[v.creator_id]
        s += (v.view_count / max_views) * 0.5  # mild popularity prior
        scored.append((s, v))
    scored.sort(key=lambda t: t[0], reverse=True)
    chosen = [v for _, v in scored[:limit]]
    return Response({
        'videos': [enrich_video(v, request.user if request.user.is_authenticated else None) for v in chosen],
        'source': 'personalised',
        'signalCount': len(recent),
    })


# --- Admin: device inventory ------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_devices(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    limit = min(int(request.query_params.get('limit', 50)), 200)
    qs = Device.objects.select_related('user').order_by('-last_seen_at')[:limit]
    items = [{
        'id': d.id, 'deviceId': d.device_id, 'fingerprint': d.fingerprint[:12],
        'userAgent': (d.user_agent or '')[:120], 'screen': d.screen,
        'timezone': d.timezone, 'lang': d.lang, 'platform': d.platform,
        'interactionCount': d.interaction_count,
        'firstSeen': d.created_at.isoformat(),
        'lastSeen': d.last_seen_at.isoformat(),
        'user': {'id': d.user_id, 'username': d.user.username} if d.user_id else None,
    } for d in qs]
    return Response({
        'devices': items,
        'totals': {
            'devices': Device.objects.count(),
            'linkedToUser': Device.objects.filter(user__isnull=False).count(),
            'interactions': DeviceInteraction.objects.count(),
        },
    })
