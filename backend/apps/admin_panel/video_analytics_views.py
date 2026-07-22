"""Video Analytics — admin dashboard endpoint.

Returns top videos by views, likes, comments + trending (high recent velocity).
"""
from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, Count, F, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.videos.models import Video, WatchHistory
from .views import require_admin


def _video_card(v, extra=None):
    d = {
        'id': v.id,
        'title': v.title,
        'thumbnailUrl': v.thumbnail_url,
        'type': v.type,
        'viewCount': v.view_count,
        'likeCount': v.like_count,
        'commentCount': v.comment_count,
        'creator': v.creator.display_name or v.creator.username if v.creator_id else None,
        'createdAt': v.created_at.isoformat(),
    }
    if extra:
        d.update(extra)
    return d


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def video_analytics(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)

    qs = Video.objects.select_related('creator').filter(is_published=True)

    # ── Top by views ──────────────────────────────────────────────────────────
    top_views = list(qs.order_by('-view_count')[:20])

    # ── Top by likes ──────────────────────────────────────────────────────────
    top_likes = list(qs.order_by('-like_count')[:20])

    # ── Top by comments ───────────────────────────────────────────────────────
    top_comments = list(qs.order_by('-comment_count')[:20])

    # ── Trending: newest videos with highest view count (last 30 days) ────────
    since_30d = timezone.now() - timedelta(days=30)
    trending = list(
        qs.filter(created_at__gte=since_30d)
          .order_by('-view_count')[:20]
    )

    # ── Currently being watched: from WatchHistory in last 24h ───────────────
    since_24h = timezone.now() - timedelta(hours=24)
    active_rows = (
        WatchHistory.objects
        .filter(updated_at__gte=since_24h)
        .values('video_id')
        .annotate(viewers=Count('user_id', distinct=True))
        .order_by('-viewers')[:20]
    )
    active_ids = [r['video_id'] for r in active_rows]
    active_map = {v.id: v for v in qs.filter(id__in=active_ids)}
    active_extra = {r['video_id']: r['viewers'] for r in active_rows}

    # ── Summary stats ─────────────────────────────────────────────────────────
    totals = qs.aggregate(
        total_views=Sum('view_count'),
        total_likes=Sum('like_count'),
        total_comments=Sum('comment_count'),
        total_videos=Count('id'),
    )

    # ── Category breakdown ────────────────────────────────────────────────────
    category_breakdown = list(
        qs.filter(category__isnull=False)
          .values('category__name')
          .annotate(
              video_count=Count('id'),
              total_views=Sum('view_count'),
          )
          .order_by('-total_views')[:10]
    )

    return Response({
        'summary': {
            'totalVideos': totals['total_videos'] or 0,
            'totalViews': totals['total_views'] or 0,
            'totalLikes': totals['total_likes'] or 0,
            'totalComments': totals['total_comments'] or 0,
        },
        'topByViews': [_video_card(v) for v in top_views],
        'topByLikes': [_video_card(v) for v in top_likes],
        'topByComments': [_video_card(v) for v in top_comments],
        'trending': [_video_card(v) for v in trending],
        'activeNow': [
            _video_card(active_map[vid], {'viewers24h': active_extra[vid]})
            for vid in active_ids
            if vid in active_map
        ],
        'categoryBreakdown': [
            {
                'category': r['category__name'],
                'videoCount': r['video_count'],
                'totalViews': r['total_views'] or 0,
            }
            for r in category_breakdown
        ],
    })
