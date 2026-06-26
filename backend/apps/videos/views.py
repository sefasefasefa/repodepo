import os
from django.db.models import Q, F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status
from .models import (
    Video, Category, VideoLike, VideoBookmark, WatchHistory,
    VideoReport, Comment, CommentLike, Playlist, PlaylistVideo,
    Ad, CustomPage, WatermarkSettings, AutoCategoryRule,
    VideoPlayer, VideoSubtitle, VideoDownload
)
from apps.accounts.views import format_user as fmt_user


def enrich_video(v, user=None):
    liked = False
    bookmarked = False
    if user and user.is_authenticated:
        liked = VideoLike.objects.filter(user=user, video=v).exists()
        bookmarked = VideoBookmark.objects.filter(user=user, video=v).exists()

    cat = v.category
    creator = v.creator

    return {
        'id': v.id,
        'title': v.title,
        'description': v.description,
        'thumbnailUrl': v.thumbnail_url,
        'videoUrl': v.video_url,
        'hlsUrl': v.hls_url,
        'duration': v.duration,
        'viewCount': v.view_count,
        'likeCount': v.like_count,
        'commentCount': v.comment_count,
        'type': v.type,
        'isPremium': v.is_premium,
        'isPPV': v.is_ppv,
        'ppvPrice': float(v.ppv_price) if v.ppv_price else None,
        'isPublished': v.is_published,
        'scheduledPublishAt': v.scheduled_publish_at.isoformat() if v.scheduled_publish_at else None,
        'tags': v.tags or [],
        'categoryId': v.category_id,
        'category': {
            'id': cat.id, 'name': cat.name, 'slug': cat.slug,
            'iconUrl': cat.icon_url, 'videoCount': cat.video_count
        } if cat else None,
        'creator': fmt_user(creator) if creator else None,
        'isLiked': liked,
        'isBookmarked': bookmarked,
        'watermarkEnabled': v.watermark_enabled,
        'createdAt': v.created_at.isoformat(),
    }


def enrich_videos_bulk(videos, user=None):
    if not videos:
        return []
    liked_ids = set()
    bookmarked_ids = set()
    if user and user.is_authenticated:
        video_ids = [v.id for v in videos]
        liked_ids = set(VideoLike.objects.filter(user=user, video_id__in=video_ids).values_list('video_id', flat=True))
        bookmarked_ids = set(VideoBookmark.objects.filter(user=user, video_id__in=video_ids).values_list('video_id', flat=True))

    result = []
    for v in videos:
        cat = v.category
        creator = v.creator
        result.append({
            'id': v.id,
            'title': v.title,
            'description': v.description,
            'thumbnailUrl': v.thumbnail_url,
            'videoUrl': v.video_url,
            'hlsUrl': v.hls_url,
            'duration': v.duration,
            'viewCount': v.view_count,
            'likeCount': v.like_count,
            'commentCount': v.comment_count,
            'type': v.type,
            'isPremium': v.is_premium,
            'isPPV': v.is_ppv,
            'ppvPrice': float(v.ppv_price) if v.ppv_price else None,
            'isPublished': v.is_published,
            'tags': v.tags or [],
            'categoryId': v.category_id,
            'category': {
                'id': cat.id, 'name': cat.name, 'slug': cat.slug,
                'iconUrl': cat.icon_url, 'videoCount': cat.video_count
            } if cat else None,
            'creator': fmt_user(creator) if creator else None,
            'isLiked': v.id in liked_ids,
            'isBookmarked': v.id in bookmarked_ids,
            'watermarkEnabled': v.watermark_enabled,
            'scheduledPublishAt': v.scheduled_publish_at.isoformat() if v.scheduled_publish_at else None,
            'createdAt': v.created_at.isoformat(),
        })
    return result


def auto_publish_scheduled():
    """Zamanı gelen zamanlanmış videoları yayınla."""
    now = timezone.now()
    Video.objects.filter(
        is_published=False,
        scheduled_publish_at__isnull=False,
        scheduled_publish_at__lte=now,
    ).update(is_published=True)


@api_view(['GET'])
@permission_classes([AllowAny])
def list_videos(request):
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    category_id = request.query_params.get('categoryId')
    video_type = request.query_params.get('type')
    is_premium = request.query_params.get('isPremium')
    sort = request.query_params.get('sort', 'latest')
    creator_id = request.query_params.get('creatorId')

    auto_publish_scheduled()
    qs = Video.objects.filter(is_published=True).select_related('creator', 'category')
    if category_id:
        qs = qs.filter(category_id=category_id)
    if video_type:
        qs = qs.filter(type=video_type)
    if is_premium is not None:
        qs = qs.filter(is_premium=is_premium.lower() == 'true')
    if creator_id:
        qs = qs.filter(creator_id=creator_id)

    if sort == 'most_viewed':
        qs = qs.order_by('-view_count')
    elif sort == 'most_liked':
        qs = qs.order_by('-like_count')
    else:
        qs = qs.order_by('-created_at')

    total = qs.count()
    videos = list(qs[offset:offset + limit])
    return Response({
        'videos': enrich_videos_bulk(videos, request.user),
        'total': total, 'page': page, 'limit': limit,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_feed(request):
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    qs = Video.objects.filter(is_published=True, type='video').select_related('creator', 'category').order_by('-created_at')
    total = qs.count()
    videos = list(qs[offset:offset + limit])
    return Response({
        'videos': enrich_videos_bulk(videos, request.user),
        'total': total, 'page': page, 'limit': limit,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_trending(request):
    limit = min(int(request.query_params.get('limit', 20)), 50)
    qs = Video.objects.filter(is_published=True).select_related('creator', 'category').order_by('-view_count', '-like_count')[:limit]
    return Response({'videos': enrich_videos_bulk(list(qs), request.user)})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_shorts(request):
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    qs = Video.objects.filter(is_published=True, type='short').select_related('creator', 'category').order_by('-created_at')
    total = qs.count()
    videos = list(qs[offset:offset + limit])
    return Response({'videos': enrich_videos_bulk(videos, request.user), 'total': total})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_video(request, video_id):
    try:
        v = Video.objects.select_related('creator', 'category').get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video not found'}, status=404)
    return Response(enrich_video(v, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_video(request):
    user = request.user
    if user.role not in ('creator', 'admin', 'moderator'):
        return Response({'error': 'Creator hesabı gerekli'}, status=403)
    data = request.data

    # Zamanlanmış yayın tarihi
    from django.utils.dateparse import parse_datetime
    scheduled_raw = data.get('scheduledPublishAt', data.get('scheduled_publish_at'))
    scheduled_dt = None
    if scheduled_raw:
        try:
            scheduled_dt = parse_datetime(scheduled_raw)
            if scheduled_dt and timezone.is_naive(scheduled_dt):
                scheduled_dt = timezone.make_aware(scheduled_dt)
        except Exception:
            scheduled_dt = None

    # Zamanlanmışsa yayına çıkma, yoksa normal
    is_published = data.get('isPublished', data.get('is_published', True))
    if scheduled_dt:
        is_published = False

    video = Video.objects.create(
        title=data.get('title', 'Başlıksız Video'),
        description=data.get('description'),
        video_url=data.get('videoUrl', data.get('video_url')),
        hls_url=data.get('hlsUrl', data.get('hls_url')),
        thumbnail_url=data.get('thumbnailUrl', data.get('thumbnail_url')),
        duration=data.get('duration'),
        type=data.get('type', 'video'),
        is_premium=data.get('isPremium', data.get('is_premium', False)),
        is_ppv=data.get('isPPV', data.get('is_ppv', False)),
        ppv_price=data.get('ppvPrice', data.get('ppv_price')),
        is_published=is_published,
        scheduled_publish_at=scheduled_dt,
        tags=data.get('tags', []),
        creator=user,
        category_id=data.get('categoryId', data.get('category_id')),
        watermark_enabled=data.get('watermarkEnabled', data.get('watermark_enabled', False)),
    )
    from django.db.models import F
    user.video_count = F('video_count') + 1
    user.save(update_fields=['video_count'])

    # Optional cross-posting
    try:
        site_ids = data.get('crossPostSiteIds')
        auto_flag = data.get('autoCrossPost', True)
        if site_ids or auto_flag:
            from apps.crosspost.dispatcher import dispatch_for_video
            dispatch_for_video(video, user, site_ids)
    except Exception:
        pass

    return Response(enrich_video(video), status=201)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_video(request, video_id):
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video not found'}, status=404)
    if video.creator != request.user and request.user.role != 'admin':
        return Response({'error': 'Forbidden'}, status=403)
    data = request.data

    from django.utils.dateparse import parse_datetime
    scheduled_raw = data.get('scheduledPublishAt', data.get('scheduled_publish_at'))
    if scheduled_raw is not None:
        try:
            dt = parse_datetime(scheduled_raw) if scheduled_raw else None
            if dt and timezone.is_naive(dt):
                dt = timezone.make_aware(dt)
            video.scheduled_publish_at = dt
            if dt:
                video.is_published = False
        except Exception:
            pass
    elif 'scheduledPublishAt' in data and data['scheduledPublishAt'] is None:
        video.scheduled_publish_at = None

    for field, value in {
        'title': data.get('title'),
        'description': data.get('description'),
        'thumbnail_url': data.get('thumbnailUrl', data.get('thumbnail_url')),
        'video_url': data.get('videoUrl', data.get('video_url')),
        'hls_url': data.get('hlsUrl', data.get('hls_url')),
        'duration': data.get('duration'),
        'type': data.get('type'),
        'is_premium': data.get('isPremium', data.get('is_premium')),
        'is_ppv': data.get('isPPV', data.get('is_ppv')),
        'ppv_price': data.get('ppvPrice', data.get('ppv_price')),
        'is_published': data.get('isPublished', data.get('is_published')),
        'tags': data.get('tags'),
        'category_id': data.get('categoryId', data.get('category_id')),
    }.items():
        if value is not None:
            setattr(video, field, value)
    video.save()
    # Category-assignment signal for the AI trainer
    new_cat = data.get('categoryId', data.get('category_id'))
    if new_cat is not None:
        try:
            from apps.ai.views import record_event
            record_event('category_assigned', video=video, user=request.user,
                         payload={'categoryId': new_cat, 'source': 'admin_or_creator'},
                         status='auto')
        except Exception:
            pass
    return Response(enrich_video(video, request.user))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_scheduled_videos(request):
    """Kullanıcının zamanlanmış (henüz yayınlanmamış) videolarını listele."""
    qs = Video.objects.filter(
        creator=request.user,
        is_published=False,
        scheduled_publish_at__isnull=False,
    ).select_related('category').order_by('scheduled_publish_at')
    return Response({'videos': [enrich_video(v, request.user) for v in qs]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel_schedule(request, video_id):
    """Zamanlanmış yayını iptal et — taslak olarak tut."""
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if video.creator != request.user and request.user.role != 'admin':
        return Response({'error': 'Yetkisiz'}, status=403)
    video.scheduled_publish_at = None
    video.is_published = False
    video.save(update_fields=['scheduled_publish_at', 'is_published'])
    return Response(enrich_video(video, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reschedule_video(request, video_id):
    """Zamanlanmış videonun yayın tarihini güncelle."""
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if video.creator != request.user and request.user.role != 'admin':
        return Response({'error': 'Yetkisiz'}, status=403)
    from django.utils.dateparse import parse_datetime
    raw = request.data.get('scheduledPublishAt')
    if not raw:
        return Response({'error': 'scheduledPublishAt gerekli'}, status=400)
    try:
        dt = parse_datetime(raw)
        if dt and timezone.is_naive(dt):
            dt = timezone.make_aware(dt)
    except Exception:
        return Response({'error': 'Geçersiz tarih formatı'}, status=400)
    if not dt or dt <= timezone.now():
        return Response({'error': 'Tarih gelecekte olmalı'}, status=400)
    video.scheduled_publish_at = dt
    video.is_published = False
    video.save(update_fields=['scheduled_publish_at', 'is_published'])
    return Response(enrich_video(video, request.user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def publish_now(request, video_id):
    """Zamanlanmış videoyu hemen yayınla."""
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if video.creator != request.user and request.user.role != 'admin':
        return Response({'error': 'Yetkisiz'}, status=403)
    video.is_published = True
    video.scheduled_publish_at = None
    video.save(update_fields=['is_published', 'scheduled_publish_at'])
    return Response(enrich_video(video, request.user))


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_video(request, video_id):
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video not found'}, status=404)
    if video.creator != request.user and request.user.role != 'admin':
        return Response({'error': 'Forbidden'}, status=403)
    video.delete()
    return Response({'message': 'Video deleted'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def like_video(request, video_id):
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video not found'}, status=404)
    like, created = VideoLike.objects.get_or_create(user=request.user, video=video)
    if created:
        Video.objects.filter(id=video_id).update(like_count=F('like_count') + 1)
        try:
            from apps.ai.views import record_event
            record_event('engagement', video=video, user=request.user, payload={'kind': 'likes'})
        except Exception:
            pass
    return Response({'isLiked': True, 'likeCount': video.like_count + (1 if created else 0)})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def unlike_video(request, video_id):
    deleted, _ = VideoLike.objects.filter(user=request.user, video_id=video_id).delete()
    if deleted:
        Video.objects.filter(id=video_id).update(like_count=F('like_count') - 1)
    return Response({'isLiked': False})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bookmark_video(request, video_id):
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video not found'}, status=404)
    VideoBookmark.objects.get_or_create(user=request.user, video=video)
    return Response({'isBookmarked': True})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def unbookmark_video(request, video_id):
    VideoBookmark.objects.filter(user=request.user, video_id=video_id).delete()
    return Response({'isBookmarked': False})


@api_view(['POST'])
@permission_classes([AllowAny])
def record_view(request, video_id):
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video not found'}, status=404)
    Video.objects.filter(id=video_id).update(view_count=F('view_count') + 1)
    watch_time = request.data.get('watchTime', request.data.get('watch_time', 0))
    completion_rate = request.data.get('completionRate', request.data.get('completion_rate', 0))
    if request.user.is_authenticated:
        wh, created = WatchHistory.objects.get_or_create(user=request.user, video=video)
        if not created:
            wh.watch_time = watch_time
            wh.completion_rate = completion_rate
            wh.save()
    # AI training signal — fire-and-forget; never break view recording
    try:
        from apps.ai.views import record_event
        record_event('video_view', video=video,
                     user=request.user if request.user.is_authenticated else None,
                     payload={'completionRate': float(completion_rate or 0)})
        if watch_time:
            record_event('watch_progress', video=video,
                         user=request.user if request.user.is_authenticated else None,
                         payload={'seconds': int(watch_time or 0)})
    except Exception:
        pass
    return Response({'message': 'View recorded'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_watch_history(request):
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    history = WatchHistory.objects.filter(user=request.user).select_related('video__creator', 'video__category').order_by('-updated_at')
    total = history.count()
    items = list(history[offset:offset + limit])
    return Response({
        'history': [{
            'id': wh.id,
            'video': enrich_video(wh.video),
            'watchTime': wh.watch_time,
            'completionRate': wh.completion_rate,
            'watchedAt': wh.updated_at.isoformat(),
        } for wh in items],
        'total': total,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_bookmarks(request):
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    bookmarks = VideoBookmark.objects.filter(user=request.user).select_related('video__creator', 'video__category').order_by('-created_at')
    total = bookmarks.count()
    items = list(bookmarks[offset:offset + limit])
    return Response({
        'bookmarks': [enrich_video(b.video, request.user) for b in items],
        'total': total,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def list_categories(request):
    cats = Category.objects.all().order_by('name')
    return Response({'categories': [
        {'id': c.id, 'name': c.name, 'slug': c.slug, 'iconUrl': c.icon_url, 'videoCount': c.video_count}
        for c in cats
    ]})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_category(request, slug):
    try:
        cat = Category.objects.get(slug=slug)
    except Category.DoesNotExist:
        return Response({'error': 'Category not found'}, status=404)
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    videos_qs = Video.objects.filter(category=cat, is_published=True).select_related('creator', 'category').order_by('-created_at')
    total = videos_qs.count()
    videos = list(videos_qs[offset:offset + limit])
    return Response({
        'category': {'id': cat.id, 'name': cat.name, 'slug': cat.slug, 'iconUrl': cat.icon_url, 'videoCount': cat.video_count},
        'videos': enrich_videos_bulk(videos, request.user),
        'total': total,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def list_comments(request, video_id):
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    comments = Comment.objects.filter(video_id=video_id, parent=None).select_related('author').order_by('-created_at')
    total = comments.count()
    items = list(comments[offset:offset + limit])
    return Response({
        'comments': [_fmt_comment(c, request.user) for c in items],
        'total': total,
    })


def _fmt_comment(c, user=None):
    liked = False
    if user and user.is_authenticated:
        liked = CommentLike.objects.filter(user=user, comment=c).exists()
    return {
        'id': c.id,
        'content': c.content,
        'videoId': c.video_id,
        'authorId': c.author_id,
        'author': fmt_user(c.author),
        'parentId': c.parent_id,
        'likeCount': c.like_count,
        'replyCount': c.reply_count,
        'isLiked': liked,
        'createdAt': c.created_at.isoformat(),
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_comment(request, video_id):
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video not found'}, status=404)
    content = request.data.get('content', '').strip()
    if not content:
        return Response({'error': 'Content required'}, status=400)
    parent_id = request.data.get('parentId', request.data.get('parent_id'))
    parent = None
    if parent_id:
        try:
            parent = Comment.objects.get(id=parent_id, video=video)
            Comment.objects.filter(id=parent_id).update(reply_count=F('reply_count') + 1)
        except Comment.DoesNotExist:
            pass
    comment = Comment.objects.create(
        content=content, video=video, author=request.user, parent=parent
    )
    Video.objects.filter(id=video_id).update(comment_count=F('comment_count') + 1)
    return Response(_fmt_comment(comment), status=201)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_comment(request, comment_id):
    try:
        comment = Comment.objects.get(id=comment_id)
    except Comment.DoesNotExist:
        return Response({'error': 'Comment not found'}, status=404)
    if comment.author != request.user and request.user.role not in ('admin', 'moderator'):
        return Response({'error': 'Forbidden'}, status=403)
    comment.delete()
    return Response({'message': 'Comment deleted'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def like_comment(request, comment_id):
    try:
        comment = Comment.objects.get(id=comment_id)
    except Comment.DoesNotExist:
        return Response({'error': 'Comment not found'}, status=404)
    _, created = CommentLike.objects.get_or_create(user=request.user, comment=comment)
    if created:
        Comment.objects.filter(id=comment_id).update(like_count=F('like_count') + 1)
    return Response({'isLiked': True})


@api_view(['GET'])
@permission_classes([AllowAny])
def list_playlists(request):
    user_id = request.query_params.get('userId')
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit

    qs = Playlist.objects.select_related('owner')
    if user_id:
        qs = qs.filter(owner_id=user_id)
    elif request.user.is_authenticated:
        qs = qs.filter(owner=request.user)
    else:
        qs = qs.filter(is_public=True)

    total = qs.count()
    playlists = list(qs[offset:offset + limit])
    return Response({
        'playlists': [_fmt_playlist(p) for p in playlists],
        'total': total,
    })


def _fmt_playlist(p):
    return {
        'id': p.id,
        'title': p.title,
        'description': p.description,
        'thumbnailUrl': p.thumbnail_url,
        'isPublic': p.is_public,
        'videoCount': p.video_count,
        'ownerId': p.owner_id,
        'createdAt': p.created_at.isoformat(),
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_playlist(request):
    data = request.data
    pl = Playlist.objects.create(
        title=data.get('title', 'Yeni Playlist'),
        description=data.get('description'),
        is_public=data.get('isPublic', True),
        owner=request.user,
    )
    return Response(_fmt_playlist(pl), status=201)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_playlist(request, playlist_id):
    try:
        pl = Playlist.objects.select_related('owner').get(id=playlist_id)
    except Playlist.DoesNotExist:
        return Response({'error': 'Playlist not found'}, status=404)
    pvs = PlaylistVideo.objects.filter(playlist=pl).select_related('video__creator', 'video__category').order_by('position')
    videos = enrich_videos_bulk([pv.video for pv in pvs], request.user)
    result = _fmt_playlist(pl)
    result['videos'] = videos
    return Response(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_to_playlist(request, playlist_id):
    try:
        pl = Playlist.objects.get(id=playlist_id, owner=request.user)
    except Playlist.DoesNotExist:
        return Response({'error': 'Playlist not found'}, status=404)
    video_id = request.data.get('videoId', request.data.get('video_id'))
    if not video_id:
        return Response({'error': 'videoId required'}, status=400)
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video not found'}, status=404)
    _, created = PlaylistVideo.objects.get_or_create(playlist=pl, video=video)
    if created:
        Playlist.objects.filter(id=playlist_id).update(video_count=F('video_count') + 1)
    return Response({'message': 'Video added'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_from_playlist(request, playlist_id, video_id):
    try:
        pl = Playlist.objects.get(id=playlist_id, owner=request.user)
    except Playlist.DoesNotExist:
        return Response({'error': 'Playlist not found'}, status=404)
    deleted, _ = PlaylistVideo.objects.filter(playlist=pl, video_id=video_id).delete()
    if deleted:
        Playlist.objects.filter(id=playlist_id).update(video_count=F('video_count') - 1)
    return Response({'message': 'Video removed'})


@api_view(['GET'])
@permission_classes([AllowAny])
def search_videos(request):
    q = request.query_params.get('q', '').strip()
    if not q:
        return Response({'error': 'Query required'}, status=400)
    limit = min(int(request.query_params.get('limit', 20)), 50)
    page = int(request.query_params.get('page', 1))
    offset = (page - 1) * limit
    search_type = request.query_params.get('type', 'all')

    from django.contrib.auth import get_user_model
    User = get_user_model()

    users = []
    videos = []

    if search_type in ('all', 'users'):
        users = list(User.objects.filter(
            Q(username__icontains=q) | Q(display_name__icontains=q)
        )[:limit])

    if search_type in ('all', 'videos'):
        qs = Video.objects.filter(
            Q(title__icontains=q) | Q(description__icontains=q),
            is_published=True
        ).select_related('creator', 'category').order_by('-view_count')
        videos = list(qs[offset:offset + limit])

    return Response({
        'videos': enrich_videos_bulk(videos, request.user),
        'users': [fmt_user(u) for u in users],
        'query': q,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def report_content(request):
    data = request.data
    VideoReport.objects.create(
        content_type=data.get('contentType', 'video'),
        video_id=data.get('videoId'),
        reported_user_id=data.get('reportedUserId'),
        reporter=request.user,
        reason=data.get('reason', 'other'),
        description=data.get('description'),
    )
    return Response({'message': 'Report submitted'}, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_video(request):
    user = request.user
    if user.role not in ('creator', 'admin', 'moderator'):
        return Response({'error': 'Creator hesabı gerekli'}, status=403)

    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'Dosya bulunamadı'}, status=400)

    ALLOWED_EXTS = {'.mp4', '.m4v', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ts', '.m3u8'}
    ext = os.path.splitext(file.name)[1].lower()
    if ext not in ALLOWED_EXTS:
        return Response({'error': f'Desteklenmeyen format: {ext}'}, status=400)

    from django.conf import settings as django_settings
    import uuid
    filename = f'{uuid.uuid4().hex}{ext}'
    upload_path = os.path.join(django_settings.MEDIA_ROOT, 'uploads', filename)
    os.makedirs(os.path.dirname(upload_path), exist_ok=True)

    with open(upload_path, 'wb+') as dest:
        for chunk in file.chunks():
            dest.write(chunk)

    local_url = f'/media/uploads/{filename}'
    title = request.data.get('title', file.name.rsplit('.', 1)[0])
    is_hls = ext in {'.m3u8', '.m3u'}

    video = Video.objects.create(
        title=title,
        description=request.data.get('description'),
        video_url=None if is_hls else local_url,
        hls_url=local_url if is_hls else None,
        creator=user,
        category_id=request.data.get('categoryId') or None,
        is_published=request.data.get('isPublic', 'true').lower() != 'false',
    )
    from django.db.models import F
    from django.contrib.auth import get_user_model
    User = get_user_model()
    User.objects.filter(id=user.id).update(video_count=F('video_count') + 1)

    return Response({
        'message': 'Yüklendi',
        'videoId': video.id,
        'url': local_url,
        'filename': filename,
    }, status=201)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_ads(request):
    position = request.query_params.get('position')
    qs = Ad.objects.filter(is_active=True)
    if position:
        qs = qs.filter(position=position)
    now = timezone.now()
    qs = qs.filter(Q(starts_at__isnull=True) | Q(starts_at__lte=now))
    qs = qs.filter(Q(ends_at__isnull=True) | Q(ends_at__gte=now))
    return Response({'ads': [{
        'id': a.id, 'name': a.name, 'type': a.type, 'position': a.position,
        'imageUrl': a.image_url, 'videoUrl': a.video_url, 'targetUrl': a.target_url,
        'scriptCode': a.script_code, 'impressions': a.impressions, 'clicks': a.clicks,
    } for a in qs]})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_watermark(request):
    settings_obj, _ = WatermarkSettings.objects.get_or_create(id=1)
    return Response({
        'isEnabled': settings_obj.is_enabled,
        'imageUrl': settings_obj.image_url,
        'text': settings_obj.text,
        'useImage': settings_obj.use_image,
        'position': settings_obj.position,
        'size': settings_obj.size,
        'opacity': settings_obj.opacity,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_custom_page(request, slug):
    try:
        page = CustomPage.objects.get(slug=slug, is_published=True)
    except CustomPage.DoesNotExist:
        return Response({'error': 'Page not found'}, status=404)
    return Response({'id': page.id, 'slug': page.slug, 'title': page.title, 'content': page.content})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_related_videos(request, video_id):
    limit = min(int(request.query_params.get('limit', 10)), 20)
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'videos': []})
    qs = Video.objects.filter(
        Q(category=video.category) | Q(creator=video.creator),
        is_published=True
    ).exclude(id=video_id).select_related('creator', 'category').order_by('-view_count')[:limit]
    return Response({'videos': enrich_videos_bulk(list(qs), request.user)})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_video_subtitles(request, video_id):
    subs = VideoSubtitle.objects.filter(video_id=video_id)
    return Response({'subtitles': [{
        'id': s.id, 'language': s.language, 'label': s.label, 'isAutoGenerated': s.is_auto_generated
    } for s in subs]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_subtitle(request, video_id):
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video not found'}, status=404)
    if video.creator != request.user and request.user.role != 'admin':
        return Response({'error': 'Forbidden'}, status=403)
    lang = request.data.get('language', 'tr')
    label = request.data.get('label', lang)
    vtt = request.data.get('vttContent', request.data.get('vtt_content', ''))
    sub, _ = VideoSubtitle.objects.update_or_create(
        video=video, language=lang,
        defaults={'label': label, 'vtt_content': vtt}
    )
    return Response({'id': sub.id, 'language': sub.language, 'label': sub.label}, status=201)
