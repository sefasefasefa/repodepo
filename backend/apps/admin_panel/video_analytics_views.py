"""Video Analytics — admin dashboard endpoint.

Returns top videos by views, likes, comments + trending (high recent velocity).
Supports `period` query param for time-filtered rankings.
"""
from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, Count, F, Q
from django.db.models.functions import TruncMinute, TruncHour, TruncDay, TruncWeek, TruncMonth
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.videos.models import Video, WatchHistory, VideoLike
from .views import require_admin

# Period → timedelta (None = all-time)
PERIODS = {
    '5min': timedelta(minutes=5),
    '1h':   timedelta(hours=1),
    '24h':  timedelta(hours=24),
    '7d':   timedelta(days=7),
    '30d':  timedelta(days=30),
    '3m':   timedelta(days=90),
    '6m':   timedelta(days=180),
    '1y':   timedelta(days=365),
    'all':  None,
}


def _since(period: str):
    """Return the start datetime for the given period, or None for all-time."""
    td = PERIODS.get(period)
    return timezone.now() - td if td else None


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

    period = request.GET.get('period', 'all')
    since = _since(period)

    base_qs = Video.objects.select_related('creator').filter(is_published=True)

    # ── All-time cumulative rankings ──────────────────────────────────────────
    top_views    = list(base_qs.order_by('-view_count')[:20])
    top_likes    = list(base_qs.order_by('-like_count')[:20])
    top_comments = list(base_qs.order_by('-comment_count')[:20])

    # ── Period-filtered: most watched in window (via WatchHistory) ────────────
    if since:
        watch_rows = (
            WatchHistory.objects
            .filter(updated_at__gte=since)
            .values('video_id')
            .annotate(period_views=Count('user_id', distinct=True))
            .order_by('-period_views')[:20]
        )
        period_view_ids  = [r['video_id'] for r in watch_rows]
        period_view_map  = {v.id: v for v in base_qs.filter(id__in=period_view_ids)}
        period_view_extra = {r['video_id']: r['period_views'] for r in watch_rows}
        top_views_period = [
            _video_card(period_view_map[vid], {'periodViews': period_view_extra[vid]})
            for vid in period_view_ids if vid in period_view_map
        ]

        like_rows = (
            VideoLike.objects
            .filter(created_at__gte=since)
            .values('video_id')
            .annotate(period_likes=Count('id'))
            .order_by('-period_likes')[:20]
        )
        period_like_ids  = [r['video_id'] for r in like_rows]
        period_like_map  = {v.id: v for v in base_qs.filter(id__in=period_like_ids)}
        period_like_extra = {r['video_id']: r['period_likes'] for r in like_rows}
        top_likes_period = [
            _video_card(period_like_map[vid], {'periodLikes': period_like_extra[vid]})
            for vid in period_like_ids if vid in period_like_map
        ]
    else:
        top_views_period = [_video_card(v) for v in top_views]
        top_likes_period = [_video_card(v) for v in top_likes]

    # ── Trending: newest with highest view count (last 30 days) ───────────────
    since_30d = timezone.now() - timedelta(days=30)
    trending = list(
        base_qs.filter(created_at__gte=since_30d)
               .order_by('-view_count')[:20]
    )

    # ── Currently being watched: WatchHistory last 24 h ──────────────────────
    since_24h = timezone.now() - timedelta(hours=24)
    active_rows = (
        WatchHistory.objects
        .filter(updated_at__gte=since_24h)
        .values('video_id')
        .annotate(viewers=Count('user_id', distinct=True))
        .order_by('-viewers')[:20]
    )
    active_ids   = [r['video_id'] for r in active_rows]
    active_map   = {v.id: v for v in base_qs.filter(id__in=active_ids)}
    active_extra = {r['video_id']: r['viewers'] for r in active_rows}

    # ── Summary stats ─────────────────────────────────────────────────────────
    totals = base_qs.aggregate(
        total_views=Sum('view_count'),
        total_likes=Sum('like_count'),
        total_comments=Sum('comment_count'),
        total_videos=Count('id'),
    )

    # Period-specific totals
    if since:
        period_view_total = WatchHistory.objects.filter(updated_at__gte=since).values('user_id', 'video_id').distinct().count()
        period_like_total = VideoLike.objects.filter(created_at__gte=since).count()
        period_new_videos = base_qs.filter(created_at__gte=since).count()
    else:
        period_view_total = totals['total_views'] or 0
        period_like_total = totals['total_likes'] or 0
        period_new_videos = totals['total_videos'] or 0

    # ── Category breakdown ────────────────────────────────────────────────────
    category_breakdown = list(
        base_qs.filter(category__isnull=False)
               .values('category__name')
               .annotate(video_count=Count('id'), total_views=Sum('view_count'))
               .order_by('-total_views')[:10]
    )

    return Response({
        'period': period,
        'summary': {
            'totalVideos':    totals['total_videos'] or 0,
            'totalViews':     totals['total_views'] or 0,
            'totalLikes':     totals['total_likes'] or 0,
            'totalComments':  totals['total_comments'] or 0,
            'periodViews':    period_view_total,
            'periodLikes':    period_like_total,
            'periodNewVideos': period_new_videos,
        },
        'topByViews':         [_video_card(v) for v in top_views],
        'topByLikes':         [_video_card(v) for v in top_likes],
        'topByComments':      [_video_card(v) for v in top_comments],
        'topByViewsPeriod':   top_views_period,
        'topByLikesPeriod':   top_likes_period,
        'trending':           [_video_card(v) for v in trending],
        'activeNow': [
            _video_card(active_map[vid], {'viewers24h': active_extra[vid]})
            for vid in active_ids if vid in active_map
        ],
        'categoryBreakdown': [
            {
                'category':   r['category__name'],
                'videoCount': r['video_count'],
                'totalViews': r['total_views'] or 0,
            }
            for r in category_breakdown
        ],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def video_trends(request):
    """Time-series chart: video views (WatchHistory) + likes (VideoLike) over time."""
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)

    period = request.GET.get('period', '7d')
    since  = _since(period)

    # Determine bucket
    if period in ('5min', '1h'):
        bucket = 'minute'
    elif period in ('24h', '7d'):
        bucket = 'hour'
    elif period in ('30d', '3m'):
        bucket = 'day'
    elif period in ('6m', '1y'):
        bucket = 'week'
    else:
        bucket = 'month'

    trunc_fn = {
        'minute': TruncMinute,
        'hour':   TruncHour,
        'day':    TruncDay,
        'week':   TruncWeek,
        'month':  TruncMonth,
    }[bucket]

    # Views from WatchHistory
    wh_qs = WatchHistory.objects.all()
    if since:
        wh_qs = wh_qs.filter(updated_at__gte=since)
    view_rows = (
        wh_qs.annotate(bucket=trunc_fn('updated_at'))
             .values('bucket')
             .annotate(views=Count('id'), unique_viewers=Count('user_id', distinct=True))
             .order_by('bucket')
    )

    # Likes from VideoLike
    like_qs = VideoLike.objects.all()
    if since:
        like_qs = like_qs.filter(created_at__gte=since)
    like_rows = (
        like_qs.annotate(bucket=trunc_fn('created_at'))
               .values('bucket')
               .annotate(likes=Count('id'))
               .order_by('bucket')
    )

    # Merge into a single time series
    views_map = {r['bucket'].isoformat(): {'views': r['views'], 'uniqueViewers': r['unique_viewers']} for r in view_rows}
    likes_map = {r['bucket'].isoformat(): r['likes'] for r in like_rows}

    all_keys = sorted(set(list(views_map.keys()) + list(likes_map.keys())))
    points = [
        {
            'time':          k,
            'views':         views_map.get(k, {}).get('views', 0),
            'uniqueViewers': views_map.get(k, {}).get('uniqueViewers', 0),
            'likes':         likes_map.get(k, 0),
        }
        for k in all_keys
    ]

    return Response({'bucket': bucket, 'period': period, 'points': points})
