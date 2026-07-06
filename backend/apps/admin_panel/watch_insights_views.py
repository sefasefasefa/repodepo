"""Admin-only İzleme/İlgili Video analitiği: WatchHistory verisinden
en çok birlikte izlenen video çiftlerini, en çok izlenen videoları ve
genel izleme istatistiklerini üretir. Bu, `get_related_videos` endpoint'inin
kullandığı işbirlikçi filtreleme sinyalinin admin panelde görünür hale
getirilmiş halidir — video izleme sayfasında herhangi bir değişiklik yapmaz."""
from django.db.models import Count, Avg, Sum, F, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.videos.models import Video, WatchHistory
from .views import require_admin


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def watch_insights(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)

    qs = WatchHistory.objects.all()
    total_history = qs.count()
    unique_viewers = qs.values('user_id').distinct().count()

    agg = qs.aggregate(
        avg_completion=Avg('completion_rate'),
        avg_pause=Avg('pause_count'),
        avg_seek=Avg('seek_count'),
        avg_replay=Avg('replay_count'),
        total_sessions=Sum('session_count'),
    )
    avg_completion   = agg['avg_completion'] or 0
    avg_pause        = agg['avg_pause'] or 0
    avg_seek         = agg['avg_seek'] or 0
    avg_replay       = agg['avg_replay'] or 0
    total_sessions   = agg['total_sessions'] or 0

    # Replay rate: share of records where user rewatched at least once
    replay_rate = 0
    if total_history > 0:
        replayed = qs.filter(replay_count__gt=0).count()
        replay_rate = round(replayed / total_history * 100, 1)

    # Completion-rate buckets (engagement depth)
    buckets = {
        '0_25':  qs.filter(completion_rate__lt=25).count(),
        '25_50': qs.filter(completion_rate__gte=25, completion_rate__lt=50).count(),
        '50_75': qs.filter(completion_rate__gte=50, completion_rate__lt=75).count(),
        '75_100': qs.filter(completion_rate__gte=75).count(),
    }

    # ── Top watched videos (enriched with rich signals) ──────────────────────
    top_watched_rows = (
        qs.values('video_id')
        .annotate(
            viewers=Count('user_id', distinct=True),
            avg_completion=Avg('completion_rate'),
            total_sessions=Sum('session_count'),
            avg_pause=Avg('pause_count'),
            avg_seek=Avg('seek_count'),
        )
        .order_by('-viewers')[:15]
    )
    top_video_ids = [r['video_id'] for r in top_watched_rows]
    videos_by_id = {
        v.id: v for v in Video.objects.filter(id__in=top_video_ids).select_related('creator', 'category')
    }
    top_watched = []
    for r in top_watched_rows:
        v = videos_by_id.get(r['video_id'])
        if not v:
            continue
        top_watched.append({
            'videoId': v.id,
            'title': v.title,
            'thumbnailUrl': v.thumbnail_url,
            'category': v.category.name if v.category_id else None,
            'creator': v.creator.display_name or v.creator.username if v.creator_id else None,
            'viewers': r['viewers'],
            'avgCompletion': round(r['avg_completion'] or 0, 1),
            'totalSessions': r['total_sessions'] or 0,
            'avgPause': round(r['avg_pause'] or 0, 1),
            'avgSeek': round(r['avg_seek'] or 0, 1),
        })

    # ── Most-replayed videos (sticky content signal) ──────────────────────────
    sticky_rows = (
        qs.filter(replay_count__gt=0)
        .values('video_id')
        .annotate(
            total_replays=Sum('replay_count'),
            replayers=Count('user_id', distinct=True),
        )
        .order_by('-total_replays')[:10]
    )
    sticky_video_ids = [r['video_id'] for r in sticky_rows]
    sticky_videos_map = {
        v.id: v for v in Video.objects.filter(id__in=sticky_video_ids).select_related('creator')
    }
    sticky_videos = []
    for r in sticky_rows:
        v = sticky_videos_map.get(r['video_id'])
        if not v:
            continue
        sticky_videos.append({
            'videoId': v.id,
            'title': v.title,
            'totalReplays': r['total_replays'],
            'replayers': r['replayers'],
        })

    # ── Co-watch pairs: same-user video combinations ──────────────────────────
    # Weight each co-watch edge by the viewer's completion_rate so pairs where
    # both videos were actually watched (not just clicked) rank higher.
    rows = list(qs.values('user_id', 'video_id', 'completion_rate').order_by('user_id'))
    by_user: dict = {}
    for row in rows:
        by_user.setdefault(row['user_id'], []).append(
            (row['video_id'], row['completion_rate'])
        )

    pair_scores: dict = {}
    for _, vids in by_user.items():
        seen: dict = {}
        for vid, cr in vids:
            seen[vid] = max(seen.get(vid, 0), cr)
        uniq = sorted(seen.keys())
        for i in range(len(uniq)):
            for j in range(i + 1, len(uniq)):
                key = (uniq[i], uniq[j])
                weight = (seen[uniq[i]] + seen[uniq[j]]) / 200.0  # 0–1 range
                entry = pair_scores.setdefault(key, {'viewers': 0, 'score': 0.0})
                entry['viewers'] += 1
                entry['score'] += weight

    top_pairs_raw = sorted(pair_scores.items(), key=lambda kv: kv[1]['score'], reverse=True)[:15]
    pair_video_ids = {vid for pair, _ in top_pairs_raw for vid in pair}
    pair_videos = {
        v.id: v for v in Video.objects.filter(id__in=pair_video_ids).select_related('creator')
    }
    top_pairs = []
    for (vid_a, vid_b), entry in top_pairs_raw:
        va, vb = pair_videos.get(vid_a), pair_videos.get(vid_b)
        if not va or not vb:
            continue
        top_pairs.append({
            'videoA': {'id': va.id, 'title': va.title},
            'videoB': {'id': vb.id, 'title': vb.title},
            'sharedViewers': entry['viewers'],
            'engagementScore': round(entry['score'], 2),
        })

    return Response({
        'totalWatchRecords': total_history,
        'uniqueViewers': unique_viewers,
        'avgCompletionRate': round(avg_completion, 1),
        'avgPauseCount': round(avg_pause, 1),
        'avgSeekCount': round(avg_seek, 1),
        'avgReplayCount': round(avg_replay, 1),
        'replayRate': replay_rate,
        'totalSessions': total_sessions,
        'completionBuckets': buckets,
        'topWatchedVideos': top_watched,
        'stickyVideos': sticky_videos,
        'topCoWatchedPairs': top_pairs,
    })
