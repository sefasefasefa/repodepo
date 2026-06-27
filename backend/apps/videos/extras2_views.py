"""Extra video-app endpoints to reach parity with Express:
   report (sub-resource), delete watch history, ads click/impression,
   watermark config + per-video toggle, categories create/update,
   upload supported-formats, search trending, recommendations for-you/profile.
"""
from datetime import timedelta
from django.utils import timezone
from django.db.models import F, Sum, Count, Q
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from apps.accounts.authentication import BearerTokenAuthentication
from .models import (
    Video, VideoReport, WatchHistory, Category, Ad, WatermarkSettings,
    VideoLike,
)
from apps.social.models import Follow


def _is_admin(u):
    return u.is_authenticated and getattr(u, 'role', '') == 'admin'


# ─── Reports sub-resource ──────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def report_video(request, video_id):
    d = request.data or {}
    reason = d.get('reason')
    if not reason:
        return Response({'error': 'Şikayet sebebi zorunludur'}, status=400)
    VideoReport.objects.create(
        video_id=video_id, reporter=request.user,
        reason=reason, description=d.get('description', ''),
    )
    return Response({'message': 'Report submitted'})


# ─── Watch history ─────────────────────────────────────────────────────
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def clear_history(request):
    WatchHistory.objects.filter(user=request.user).delete()
    return Response({'message': 'History cleared'})


# ─── Ads click & impression ────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([AllowAny])
def ad_click(request, ad_id):
    Ad.objects.filter(id=ad_id).update(clicks=F('clicks') + 1)
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([AllowAny])
def ad_impression(request, ad_id):
    Ad.objects.filter(id=ad_id).update(impressions=F('impressions') + 1)
    return Response({'ok': True})


# ─── Watermark ─────────────────────────────────────────────────────────
def _get_watermark():
    s = WatermarkSettings.objects.first()
    if not s:
        s = WatermarkSettings.objects.create()
    return s


def _fmt_watermark(s):
    return {
        'isEnabled': s.is_enabled, 'imageUrl': s.image_url, 'text': s.text,
        'useImage': s.use_image, 'position': s.position, 'size': s.size,
        'opacity': s.opacity,
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def watermark_config(request):
    return Response({'config': _fmt_watermark(_get_watermark())})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def video_watermark(request, video_id):
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if video.creator_id != request.user.id and not _is_admin(request.user):
        return Response({'error': 'Bu video size ait değil'}, status=403)
    video.watermark_enabled = bool((request.data or {}).get('watermarkEnabled'))
    video.save(update_fields=['watermark_enabled'])
    return Response({'video': {'id': video.id, 'watermarkEnabled': video.watermark_enabled}})


# ─── Categories CRUD ───────────────────────────────────────────────────
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_category(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    d = request.data or {}
    name = (d.get('name') or '').strip()
    slug = d.get('slug') or name.lower().replace(' ', '-')
    if not name:
        return Response({'error': 'name gerekli'}, status=400)
    cat = Category.objects.create(name=name, slug=slug, icon_url=d.get('iconUrl'))
    return Response({
        'id': cat.id, 'name': cat.name, 'slug': cat.slug,
        'iconUrl': cat.icon_url, 'videoCount': cat.video_count,
    }, status=201)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_category(request, cat_id):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    try:
        cat = Category.objects.get(id=cat_id)
    except Category.DoesNotExist:
        return Response({'error': 'Category not found'}, status=404)
    d = request.data or {}
    name = (d.get('name') or '').strip()
    if not name:
        return Response({'error': 'name is required'}, status=400)
    cat.name = name
    if 'slug' in d and d['slug']:
        cat.slug = d['slug'].strip().lower().replace(' ', '-')
    if 'iconUrl' in d:
        cat.icon_url = d['iconUrl'] or None
    cat.save()
    return Response({
        'id': cat.id, 'name': cat.name, 'slug': cat.slug,
        'iconUrl': cat.icon_url, 'videoCount': cat.video_count,
    })


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_category(request, cat_id):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    try:
        cat = Category.objects.get(id=cat_id)
    except Category.DoesNotExist:
        return Response({'error': 'Category not found'}, status=404)
    cat.delete()
    return Response({'message': 'Kategori silindi'})


# ─── Upload supported formats ──────────────────────────────────────────
SUPPORTED_VIDEO_EXTS = [
    '.mp4', '.m4v', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm',
    '.ts', '.m2ts', '.mts', '.mpeg', '.mpg', '.3gp', '.3g2', '.ogv',
    '.vob', '.rm', '.rmvb', '.asf', '.divx', '.f4v', '.h264', '.hevc',
]
SUPPORTED_PLAYLIST_EXTS = ['.m3u8', '.m3u']


@api_view(['GET'])
@permission_classes([AllowAny])
def supported_formats(request):
    return Response({
        'video': SUPPORTED_VIDEO_EXTS,
        'playlist': SUPPORTED_PLAYLIST_EXTS,
        'maxSizeGB': 10,
    })


# ─── Search trending ───────────────────────────────────────────────────
@api_view(['GET'])
@permission_classes([AllowAny])
def search_trending(request):
    return Response([
        'gaming', 'music', 'dance', 'cooking', 'travel',
        'comedy', 'fashion', 'tech', 'fitness', 'beauty',
    ])


# ─── Recommendations ───────────────────────────────────────────────────
def _fmt_video(v, liked_ids=None):
    liked_ids = liked_ids or set()
    return {
        'id': v.id, 'title': v.title, 'description': v.description,
        'thumbnailUrl': v.thumbnail_url, 'videoUrl': v.video_url,
        'hlsUrl': getattr(v, 'hls_url', None), 'duration': v.duration,
        'viewCount': v.view_count, 'likeCount': v.like_count,
        'commentCount': v.comment_count, 'type': getattr(v, 'type', 'video'),
        'isPremium': getattr(v, 'is_premium', False),
        'isPPV': getattr(v, 'is_ppv', False),
        'ppvPrice': float(v.ppv_price) if getattr(v, 'ppv_price', None) else None,
        'isPublished': v.is_published, 'tags': getattr(v, 'tags', []),
        'categoryId': v.category_id,
        'creator': {
            'id': v.creator_id,
            'username': v.creator.username if v.creator_id else None,
            'displayName': v.creator.display_name if v.creator_id else None,
            'avatarUrl': v.creator.avatar_url if v.creator_id else None,
        } if v.creator_id else None,
        'isLiked': v.id in liked_ids,
        'watermarkEnabled': getattr(v, 'watermark_enabled', False),
        'createdAt': v.created_at.isoformat(),
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def recommendations_for_you(request):
    limit = min(50, int(request.GET.get('limit', 20)))
    page = max(1, int(request.GET.get('page', 1)))
    offset = (page - 1) * limit
    me = request.user if request.user.is_authenticated else None

    if not me:
        qs = (Video.objects.filter(is_published=True)
              .select_related('creator')
              .order_by('-view_count', '-like_count')[offset:offset + limit])
        return Response({
            'videos': [_fmt_video(v) for v in qs],
            'personalized': False, 'page': page, 'limit': limit,
        })

    since30 = timezone.now() - timedelta(days=30)
    history = WatchHistory.objects.filter(
        user=me, created_at__gte=since30,
    ).select_related('video').values('video__category_id', 'video__creator_id', 'video_id')
    cat_affinity, creator_affinity = {}, {}
    watched = set()
    for h in history:
        watched.add(h['video_id'])
        if h['video__category_id']:
            cat_affinity[h['video__category_id']] = cat_affinity.get(h['video__category_id'], 0) + 1
        creator_affinity[h['video__creator_id']] = creator_affinity.get(h['video__creator_id'], 0) + 1

    followed = set(Follow.objects.filter(follower=me).values_list('following_id', flat=True))

    candidates = list(Video.objects.filter(is_published=True)
                      .exclude(creator_id=me.id)
                      .select_related('creator')
                      .order_by('-created_at')[:300])
    not_watched = [v for v in candidates if v.id not in watched]
    max_cat = max(cat_affinity.values() or [1])
    max_cre = max(creator_affinity.values() or [1])
    now_ts = timezone.now().timestamp()

    def score(v):
        cat_s = (cat_affinity.get(v.category_id, 0) / max_cat) if v.category_id else 0
        cre_s = creator_affinity.get(v.creator_id, 0) / max_cre
        follow_bonus = 0.25 if v.creator_id in followed else 0
        import math
        trend = math.log1p(v.view_count) * 0.6 + math.log1p(v.like_count) * 0.4
        trend_n = min(trend / 12, 1)
        age_days = (now_ts - v.created_at.timestamp()) / 86400
        fresh = max(0, 1 - age_days / 30)
        return cat_s * 0.35 + (cre_s + follow_bonus) * 0.25 + trend_n * 0.25 + fresh * 0.15

    scored = sorted(not_watched, key=score, reverse=True)
    paged = scored[offset:offset + limit]
    liked_ids = set(VideoLike.objects.filter(
        user=me, video_id__in=[v.id for v in paged],
    ).values_list('video_id', flat=True))
    return Response({
        'videos': [_fmt_video(v, liked_ids) for v in paged],
        'personalized': True, 'page': page, 'limit': limit, 'total': len(scored),
    })


@api_view(['GET'])
@authentication_classes([BearerTokenAuthentication, JWTAuthentication])
@permission_classes([IsAuthenticated])
def recommendations_profile(request):
    me = request.user
    since30 = timezone.now() - timedelta(days=30)
    history = list(WatchHistory.objects.filter(
        user=me, created_at__gte=since30,
    ).select_related('video', 'video__category', 'video__creator'))

    cat_map, cre_map = {}, {}
    total_watch = 0
    total_comp = 0
    for h in history:
        total_watch += getattr(h, 'watch_time', 0) or 0
        total_comp += getattr(h, 'completion_rate', 0) or 0
        v = h.video
        if v.category_id:
            c = cat_map.get(v.category_id) or {'id': v.category_id, 'name': v.category.name if v.category else '?', 'totalTime': 0, 'count': 0}
            c['totalTime'] += getattr(h, 'watch_time', 0) or 0
            c['count'] += 1
            cat_map[v.category_id] = c
        cr = cre_map.get(v.creator_id) or {
            'id': v.creator_id, 'name': v.creator.display_name or v.creator.username,
            'avatarUrl': v.creator.avatar_url, 'totalTime': 0, 'count': 0,
        }
        cr['totalTime'] += getattr(h, 'watch_time', 0) or 0
        cr['count'] += 1
        cre_map[v.creator_id] = cr

    top_cats = sorted(cat_map.values(), key=lambda x: x['totalTime'], reverse=True)[:5]
    top_cres = sorted(cre_map.values(), key=lambda x: x['totalTime'], reverse=True)[:5]
    avg_comp = round(total_comp / len(history)) if history else 0
    like_count = VideoLike.objects.filter(user=me).count()

    return Response({
        'topCategories': top_cats, 'topCreators': top_cres,
        'stats': {
            'videosWatched': len(history), 'totalWatchTime': total_watch,
            'avgCompletion': avg_comp, 'totalLikes': like_count,
        },
        'period': 'son_30_gun',
    })
