"""Admin-only İzleme/İlgili Video analitiği: WatchHistory verisinden
en çok birlikte izlenen video çiftlerini, en çok izlenen videoları ve
genel izleme istatistiklerini üretir. Bu, `get_related_videos` endpoint'inin
kullandığı işbirlikçi filtreleme sinyalinin admin panelde görünür hale
getirilmiş halidir — video izleme sayfasında herhangi bir değişiklik yapmaz."""
from django.db.models import Count, Avg
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

    total_history = WatchHistory.objects.count()
    unique_viewers = WatchHistory.objects.values('user_id').distinct().count()
    avg_completion = WatchHistory.objects.aggregate(avg=Avg('completion_rate'))['avg'] or 0

    top_watched_rows = (
        WatchHistory.objects.values('video_id')
        .annotate(viewers=Count('user_id', distinct=True), avg_completion=Avg('completion_rate'))
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
            'videoId': v.id, 'title': v.title,
            'thumbnailUrl': v.thumbnail_url,
            'category': v.category.name if v.category_id else None,
            'creator': v.creator.display_name or v.creator.username if v.creator_id else None,
            'viewers': r['viewers'],
            'avgCompletion': round(r['avg_completion'] or 0, 1),
        })

    # ── Co-watch çiftleri: aynı kullanıcının izlediği video ikilileri ──
    # (get_related_videos'un kullandığı aynı işbirlikçi sinyal, burada
    # video bazında değil, tüm platform genelinde çift olarak özetlenir.)
    pair_counts = {}
    rows = list(WatchHistory.objects.values('user_id', 'video_id').order_by('user_id'))
    by_user = {}
    for row in rows:
        by_user.setdefault(row['user_id'], []).append(row['video_id'])

    for _, vids in by_user.items():
        uniq = sorted(set(vids))
        for i in range(len(uniq)):
            for j in range(i + 1, len(uniq)):
                key = (uniq[i], uniq[j])
                pair_counts[key] = pair_counts.get(key, 0) + 1

    top_pairs_raw = sorted(pair_counts.items(), key=lambda kv: kv[1], reverse=True)[:15]
    pair_video_ids = {vid for pair, _ in top_pairs_raw for vid in pair}
    pair_videos = {
        v.id: v for v in Video.objects.filter(id__in=pair_video_ids).select_related('creator')
    }
    top_pairs = []
    for (vid_a, vid_b), count in top_pairs_raw:
        va, vb = pair_videos.get(vid_a), pair_videos.get(vid_b)
        if not va or not vb:
            continue
        top_pairs.append({
            'videoA': {'id': va.id, 'title': va.title},
            'videoB': {'id': vb.id, 'title': vb.title},
            'sharedViewers': count,
        })

    return Response({
        'totalWatchRecords': total_history,
        'uniqueViewers': unique_viewers,
        'avgCompletionRate': round(avg_completion, 1),
        'topWatchedVideos': top_watched,
        'topCoWatchedPairs': top_pairs,
    })
