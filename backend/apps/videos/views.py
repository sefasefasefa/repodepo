import os
import re
import uuid as _uuid_module
from django.db.models import Q, F, Count, ExpressionWrapper, IntegerField
from django.utils import timezone
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status


def _categories_with_stats():
    """Kategorileri gerçek video sayısı ve en popüler videonun kapak resmiyle döndürür.
    Popülerlik: sadece izlenme değil, izlenme + beğeni + yorum ağırlıklı skor."""
    cats = list(
        Category.objects.annotate(
            real_video_count=Count('videos', filter=Q(videos__is_published=True))
        ).order_by('-real_video_count', 'name')
    )
    cat_ids = [c.id for c in cats]

    cover_by_cat = {}
    if cat_ids:
        popularity_expr = ExpressionWrapper(
            F('view_count') + F('like_count') * 5 + F('comment_count') * 8,
            output_field=IntegerField()
        )
        top_videos = (
            Video.objects.filter(category_id__in=cat_ids, is_published=True)
            .annotate(popularity=popularity_expr)
            .order_by('category_id', '-popularity', '-created_at')
            .values('category_id', 'thumbnail_url')
        )
        for row in top_videos:
            cid = row['category_id']
            if cid not in cover_by_cat and row['thumbnail_url']:
                cover_by_cat[cid] = row['thumbnail_url']

    return [
        {
            'id': c.id, 'name': c.name, 'slug': c.slug, 'iconUrl': c.icon_url,
            'videoCount': c.real_video_count,
            'coverImage': cover_by_cat.get(c.id),
            'showOnHome': c.show_on_home,
            'homeOrder': c.home_order,
        }
        for c in cats
    ]


def _make_slug(title, exclude_id=None):
    """Türkçe uyumlu slug üret; çakışma varsa UUID suffix ekle."""
    tr_map = str.maketrans('çğıöşüÇĞİÖŞÜ', 'cgiosucgiosu')
    text = (title or 'video').translate(tr_map).lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text.strip())
    text = re.sub(r'-+', '-', text)
    base = text[:200].strip('-') or 'video'
    slug = base
    qs = Video.objects.filter(slug=slug)
    if exclude_id:
        qs = qs.exclude(pk=exclude_id)
    if qs.exists():
        slug = f'{base}-{str(_uuid_module.uuid4())[:8]}'
    return slug


from .models import (
    Video, Category, VideoLike, VideoBookmark, WatchHistory,
    VideoReport, Comment, CommentLike, Playlist, PlaylistVideo,
    Ad, CustomPage, WatermarkSettings, AutoCategoryRule,
    VideoPlayer, VideoSubtitle, VideoDownload
)
from apps.accounts.views import format_user as fmt_user


def _resolve_video(video_id, qs=None):
    """UUID string, slug veya eski integer pk ile Video döner, bulunamazsa None."""
    import uuid as _uuid_mod
    base = (qs or Video.objects).select_related('creator', 'category').prefetch_related('categories')
    vid_str = str(video_id).strip()
    try:
        _uuid_mod.UUID(vid_str)
        return base.filter(uuid=vid_str).first()
    except (ValueError, AttributeError):
        pass
    try:
        return base.filter(pk=int(vid_str)).first()
    except (ValueError, TypeError):
        pass
    return base.filter(slug=vid_str).first()


def _resolve_cloudmail_url(url):
    """
    cloud.mail.ru paylaşım linkini direkt CDN URL'ine çevirir.
    Sonucu 40 dakika cache'de tutar (CDN token ömrü ~60 dk).
    """
    import urllib.parse
    import requests as _rq

    if not url or 'cloud.mail.ru/public/' not in url:
        return url

    cache_key = f'cloudmail_cdn_{hash(url)}'
    cached = cache.get(cache_key)
    if cached:
        return cached

    try:
        headers = {
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/120.0.0.0 Safari/537.36'
            ),
        }
        session = _rq.Session()
        page = session.get(url, headers=headers, timeout=15)
        if page.status_code != 200:
            return url

        base_match = re.search(
            r'"weblink_view"\s*:\s*\{"count"\s*:\s*"\d+"\s*,\s*"url"\s*:\s*"([^"]+)"',
            page.text
        )
        if not base_match:
            return url

        base_url = base_match.group(1)
        parsed = urllib.parse.urlparse(url)
        path_parts = parsed.path.split('/public/', 1)
        if len(path_parts) < 2:
            return url

        weblink_path = path_parts[1]
        cdn_url = base_url + weblink_path
        cdn_resp = session.get(cdn_url, headers=headers, stream=True,
                               timeout=20, allow_redirects=True)

        ct = cdn_resp.headers.get('Content-Type', '')
        if cdn_resp.status_code == 200 and ('video' in ct or 'octet' in ct):
            resolved = cdn_resp.url
            cache.set(cache_key, resolved, 40 * 60)  # 40 dakika
            return resolved
    except Exception:
        pass

    return url


def enrich_video(v, user=None):
    liked = False
    bookmarked = False
    if user and user.is_authenticated:
        liked = VideoLike.objects.filter(user=user, video=v).exists()
        bookmarked = VideoBookmark.objects.filter(user=user, video=v).exists()

    cat = v.category
    creator = v.creator
    # prefetch_related ile yüklendiyse ekstra sorgu yapma
    try:
        cat_ids = [c.id for c in v.categories.all()]
    except Exception:
        cat_ids = []

    return {
        'id': v.id,
        'uuid': str(v.uuid),
        'slug': v.slug or None,
        'title': v.title,
        'description': v.description,
        'thumbnailUrl': v.thumbnail_url,
        'videoUrl': v.video_url,
        'hlsUrl': v.hls_url,
        'hlsStatus': getattr(v, 'hls_status', 'none'),
        'duration': v.duration,
        'viewCount': v.view_count,
        'likeCount': v.like_count,
        'guestLikeCount': getattr(v, 'guest_like_count', 0),
        'commentCount': v.comment_count,
        'type': v.type,
        'isPremium': v.is_premium,
        'isPPV': v.is_ppv,
        'ppvPrice': float(v.ppv_price) if v.ppv_price else None,
        'isPublished': v.is_published,
        'scheduledPublishAt': v.scheduled_publish_at.isoformat() if v.scheduled_publish_at else None,
        'tags': v.tags or [],
        'categoryId': v.category_id,
        'categoryIds': cat_ids,
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


def slim_video_for_card(v):
    """Ana sayfa kartı için minimum alan seti."""
    cat = v.category
    creator = v.creator
    return {
        'id': v.id,
        'slug': v.slug or None,
        'title': v.title,
        'thumbnailUrl': v.thumbnail_url,
        'videoUrl': v.video_url,
        'hlsUrl': v.hls_url,
        'duration': v.duration,
        'viewCount': v.view_count,
        'likeCount': v.like_count,
        'guestLikeCount': getattr(v, 'guest_like_count', 0),
        'commentCount': v.comment_count,
        'type': v.type,
        'isPremium': v.is_premium,
        'isPPV': v.is_ppv,
        'ppvPrice': float(v.ppv_price) if v.ppv_price else None,
        'categoryId': v.category_id,
        'category': {
            'id': cat.id, 'name': cat.name, 'slug': cat.slug,
        } if cat else None,
        'creator': {
            'id': creator.id,
            'username': creator.username,
            'displayName': creator.display_name,
            'avatarUrl': creator.avatar_url,
        } if creator else None,
        'isLiked': False,
        'isBookmarked': False,
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
        # prefetch_related ile yüklendiyse ekstra sorgu yapma
        try:
            cat_ids = [c.id for c in v.categories.all()]
        except Exception:
            cat_ids = []
        result.append({
            'id': v.id,
            'uuid': str(v.uuid),
            'slug': v.slug or None,
            'title': v.title,
            'description': v.description,
            'thumbnailUrl': v.thumbnail_url,
            'videoUrl': v.video_url,
            'hlsUrl': v.hls_url,
            'duration': v.duration,
            'viewCount': v.view_count,
            'likeCount': v.like_count,
            'guestLikeCount': getattr(v, 'guest_like_count', 0),
            'commentCount': v.comment_count,
            'type': v.type,
            'isPremium': v.is_premium,
            'isPPV': v.is_ppv,
            'ppvPrice': float(v.ppv_price) if v.ppv_price else None,
            'isPublished': v.is_published,
            'tags': v.tags or [],
            'categoryId': v.category_id,
            'categoryIds': cat_ids,
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


def _maybe_auto_publish():
    """auto_publish_scheduled'i her istekte çalıştırmak yerine 5 dakikada bir çalıştır."""
    ck = 'auto_publish_last_run'
    if cache.get(ck):
        return
    cache.set(ck, True, 300)
    try:
        auto_publish_scheduled()
    except Exception:
        pass


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
    min_views = request.query_params.get('minViews')
    min_likes = request.query_params.get('minLikes')
    duration_bucket = request.query_params.get('duration')  # short | mid | long
    tag = request.query_params.get('tag')

    _maybe_auto_publish()

    # Anonim kullanıcılar için 90 saniye önbellek
    is_anon = not request.user.is_authenticated
    if is_anon and page == 1 and not creator_id:
        ck = f'list_videos:{sort}:{category_id}:{video_type}:{is_premium}:{limit}:{min_views}:{min_likes}:{duration_bucket}:{tag}'
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)

    qs = Video.objects.filter(is_published=True).select_related('creator', 'category').prefetch_related('categories')
    if category_id:
        qs = qs.filter(category_id=category_id)
    if video_type:
        qs = qs.filter(type=video_type)
    if is_premium is not None:
        qs = qs.filter(is_premium=is_premium.lower() == 'true')
    if creator_id:
        qs = qs.filter(creator_id=creator_id)
    if min_views:
        try:
            qs = qs.filter(view_count__gte=int(min_views))
        except (ValueError, TypeError):
            pass
    if min_likes:
        try:
            qs = qs.filter(like_count__gte=int(min_likes))
        except (ValueError, TypeError):
            pass
    if duration_bucket == 'short':
        qs = qs.filter(duration__lt=600)
    elif duration_bucket == 'mid':
        qs = qs.filter(duration__gte=600, duration__lt=1800)
    elif duration_bucket == 'long':
        qs = qs.filter(duration__gte=1800)
    if tag:
        try:
            qs = qs.filter(tags__icontains=tag)
        except Exception:
            pass

    if sort == 'most_viewed':
        qs = qs.order_by('-view_count')
    elif sort == 'most_liked':
        qs = qs.order_by('-like_count')
    elif sort == 'most_commented':
        qs = qs.order_by('-comment_count')
    elif sort == 'longest':
        qs = qs.order_by('-duration')
    elif sort == 'shortest':
        qs = qs.order_by(F('duration').asc(nulls_last=True))
    elif sort == 'trending':
        popularity_expr = ExpressionWrapper(
            F('view_count') + F('like_count') * 5 + F('comment_count') * 8,
            output_field=IntegerField()
        )
        qs = qs.annotate(popularity=popularity_expr).order_by('-popularity', '-created_at')
    else:
        qs = qs.order_by('-created_at')

    total = qs.count()
    videos = list(qs[offset:offset + limit])
    result = {
        'videos': enrich_videos_bulk(videos, None if is_anon else request.user),
        'total': total, 'page': page, 'limit': limit,
    }
    if is_anon and page == 1 and not creator_id:
        cache.set(ck, result, 90)
    return Response(result)


@api_view(['GET'])
@permission_classes([AllowAny])
def list_category_tags(request, cat_id):
    """Bir kategorideki videolarda kullanılan en yaygın etiketleri döndürür (etiket filtre çipleri için)."""
    ck = f'category_tags:{cat_id}'
    cached = cache.get(ck)
    if cached is not None:
        return Response(cached)
    from collections import Counter
    tag_lists = Video.objects.filter(
        category_id=cat_id, is_published=True
    ).exclude(tags=[]).values_list('tags', flat=True)[:500]
    counter = Counter()
    for tags in tag_lists:
        if isinstance(tags, list):
            for t in tags:
                if t:
                    counter[str(t)] += 1
    top_tags = [{'tag': t, 'count': c} for t, c in counter.most_common(20)]
    result = {'tags': top_tags}
    cache.set(ck, result, 300)
    return Response(result)


@api_view(['GET'])
@permission_classes([AllowAny])
def list_video_tags(request):
    """Sitedeki tüm yayınlanmış videolarda kullanılan en yaygın etiketler (gelişmiş filtre çipleri için)."""
    ck = 'video_tags:all'
    cached = cache.get(ck)
    if cached is not None:
        return Response(cached)
    from collections import Counter
    tag_lists = Video.objects.filter(
        is_published=True
    ).exclude(tags=[]).values_list('tags', flat=True)[:1000]
    counter = Counter()
    for tags in tag_lists:
        if isinstance(tags, list):
            for t in tags:
                if t:
                    counter[str(t)] += 1
    top_tags = [{'tag': t, 'count': c} for t, c in counter.most_common(30)]
    result = {'tags': top_tags}
    cache.set(ck, result, 300)
    return Response(result)


@api_view(['GET'])
@permission_classes([AllowAny])
def get_feed(request):
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    if not request.user.is_authenticated and page == 1:
        ck = f'feed:{limit}'
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)
        qs = Video.objects.filter(is_published=True, type='video').select_related('creator', 'category').prefetch_related('categories').order_by('-created_at')
        total = qs.count()
        videos = list(qs[:limit])
        result = {'videos': enrich_videos_bulk(videos, None), 'total': total, 'page': 1, 'limit': limit}
        cache.set(ck, result, 90)
        return Response(result)
    qs = Video.objects.filter(is_published=True, type='video').select_related('creator', 'category').prefetch_related('categories').order_by('-created_at')
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
    # Anonim kullanıcılar için 2 dakika önbellekle
    if not request.user.is_authenticated:
        ck = f'trending:{limit}'
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)
        qs = Video.objects.filter(is_published=True).select_related('creator', 'category').prefetch_related('categories').order_by('-view_count', '-like_count')[:limit]
        result = {'videos': enrich_videos_bulk(list(qs), None)}
        cache.set(ck, result, 120)
        return Response(result)
    qs = Video.objects.filter(is_published=True).select_related('creator', 'category').prefetch_related('categories').order_by('-view_count', '-like_count')[:limit]
    return Response({'videos': enrich_videos_bulk(list(qs), request.user)})


HOME_CACHE_KEY = 'home_page:v2'


def _build_home_data_anon():
    """Anonim kullanıcı için anasayfa verisini oluşturur (veya cache'den döner)."""
    cached = cache.get(HOME_CACHE_KEY)
    if cached is not None:
        return cached

    base_qs = Video.objects.filter(is_published=True).select_related('creator', 'category').prefetch_related('categories')
    trending    = list(base_qs.order_by('-view_count', '-like_count')[:8])
    newest      = list(base_qs.order_by('-created_at')[:8])
    most_viewed = list(base_qs.order_by('-view_count')[:8])
    most_liked  = list(base_qs.order_by('-like_count')[:8])
    shorts      = list(base_qs.filter(type='short').order_by('-view_count')[:8])
    premium     = list(base_qs.filter(is_premium=True).order_by('-view_count')[:6])

    categories = _categories_with_stats()

    from apps.accounts.models import User as _User
    creator_qs = _User.objects.filter(role='creator').order_by('-follower_count')[:8]
    creators = [
        {'id': u.id, 'username': u.username, 'displayName': u.display_name,
         'avatarUrl': u.avatar_url, 'followerCount': u.follower_count}
        for u in creator_qs
    ]

    try:
        from apps.admin_panel.models import HomeFilter as _HF
        hf_qs = _HF.objects.filter(is_active=True).order_by('order')
        home_filters = [
            {'id': f.id, 'label': f.label, 'icon': f.icon, 'type': f.type,
             'categoryId': f.category_id, 'sortBy': f.sort_by,
             'rules': f.rules, 'order': f.order, 'isActive': f.is_active}
            for f in hf_qs
        ]
    except Exception:
        home_filters = []

    result = {
        'trending':     [slim_video_for_card(v) for v in trending],
        'newest':       [slim_video_for_card(v) for v in newest],
        'most_viewed':  [slim_video_for_card(v) for v in most_viewed],
        'most_liked':   [slim_video_for_card(v) for v in most_liked],
        'shorts':       [slim_video_for_card(v) for v in shorts],
        'premium':      [slim_video_for_card(v) for v in premium],
        'categories':   categories,
        'creators':     creators,
        'home_filters': home_filters,
    }
    cache.set(HOME_CACHE_KEY, result, 300)
    return result


@api_view(['GET'])
@permission_classes([AllowAny])
def home_page(request):
    """Anasayfa için tüm verileri tek API isteğinde döndürür. 5 dk önbellek."""
    is_anon = not request.user.is_authenticated
    if is_anon:
        data = _build_home_data_anon()
        resp = Response(data)
        resp['Cache-Control'] = 'public, s-maxage=90, max-age=90, stale-while-revalidate=60'
        return resp

    # Giriş yapmış kullanıcılar için yapısal veri (video listesi) cache'lenir,
    # isLiked/isBookmarked durumları üzerine eklenir.
    user = request.user
    STRUCT_KEY = 'home_struct:v1'
    struct = cache.get(STRUCT_KEY)
    if struct is None:
        base_qs = Video.objects.filter(is_published=True).select_related('creator', 'category').prefetch_related('categories')
        trending    = list(base_qs.order_by('-view_count', '-like_count')[:8])
        newest      = list(base_qs.order_by('-created_at')[:8])
        most_viewed = list(base_qs.order_by('-view_count')[:8])
        most_liked  = list(base_qs.order_by('-like_count')[:8])
        shorts      = list(base_qs.filter(type='short').order_by('-view_count')[:8])
        premium     = list(base_qs.filter(is_premium=True).order_by('-view_count')[:6])

        categories = _categories_with_stats()
        from apps.accounts.models import User as _User
        creator_qs = _User.objects.filter(role='creator').order_by('-follower_count')[:8]
        creators = [
            {'id': u.id, 'username': u.username, 'displayName': u.display_name,
             'avatarUrl': u.avatar_url, 'followerCount': u.follower_count}
            for u in creator_qs
        ]
        try:
            from apps.admin_panel.models import HomeFilter as _HF
            hf_qs = _HF.objects.filter(is_active=True).order_by('order')
            home_filters = [
                {'id': f.id, 'label': f.label, 'icon': f.icon, 'type': f.type,
                 'categoryId': f.category_id, 'sortBy': f.sort_by,
                 'rules': f.rules, 'order': f.order, 'isActive': f.is_active}
                for f in hf_qs
            ]
        except Exception:
            home_filters = []

        struct = {
            '_raw': {
                'trending': trending, 'newest': newest, 'most_viewed': most_viewed,
                'most_liked': most_liked, 'shorts': shorts, 'premium': premium,
            },
            'categories': categories,
            'creators': creators,
            'home_filters': home_filters,
        }
        cache.set(STRUCT_KEY, struct, 120)

    raw = struct['_raw']
    return Response({
        'trending':     enrich_videos_bulk(raw['trending'], user),
        'newest':       enrich_videos_bulk(raw['newest'], user),
        'most_viewed':  enrich_videos_bulk(raw['most_viewed'], user),
        'most_liked':   enrich_videos_bulk(raw['most_liked'], user),
        'shorts':       enrich_videos_bulk(raw['shorts'], user),
        'premium':      enrich_videos_bulk(raw['premium'], user),
        'categories':   struct['categories'],
        'creators':     struct['creators'],
        'home_filters': struct['home_filters'],
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_shorts(request):
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    if not request.user.is_authenticated and page == 1:
        ck = f'shorts:{limit}'
        cached = cache.get(ck)
        if cached is not None:
            return Response(cached)
        qs = Video.objects.filter(is_published=True, type='short').select_related('creator', 'category').prefetch_related('categories').order_by('-created_at')
        total = qs.count()
        videos = list(qs[:limit])
        result = {'videos': enrich_videos_bulk(videos, None), 'total': total}
        cache.set(ck, result, 90)
        return Response(result)
    qs = Video.objects.filter(is_published=True, type='short').select_related('creator', 'category').prefetch_related('categories').order_by('-created_at')
    total = qs.count()
    videos = list(qs[offset:offset + limit])
    return Response({'videos': enrich_videos_bulk(videos, request.user), 'total': total})


@api_view(['GET', 'PATCH', 'PUT'])
@permission_classes([AllowAny])
def get_video(request, video_id):
    if request.method in ('PATCH', 'PUT'):
        if not request.user.is_authenticated:
            return Response({'error': 'Authentication required'}, status=401)
        video = _resolve_video(video_id)
        if not video:
            return Response({'error': 'Video not found'}, status=404)
        if video.creator != request.user and request.user.role != 'admin':
            return Response({'error': 'Forbidden'}, status=403)
        data = request.data
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
        cache.delete(HOME_CACHE_KEY)
        cache.delete('init_anon:v1')
        return Response(enrich_video(video, request.user))
    v = _resolve_video(video_id)
    if not v:
        return Response({'error': 'Video not found'}, status=404)

    # Short-lived per-user cache so repeat views (page refresh, back-navigation) skip DB
    uid = request.user.id if request.user.is_authenticated else 'anon'
    ck = f'video_detail:{v.pk}:{uid}'
    cached = cache.get(ck)
    if cached:
        return Response(cached)

    data = enrich_video(v, request.user)

    # Include follow status so frontend doesn't need a second round-trip
    if request.user.is_authenticated and v.creator_id:
        from apps.social.models import Follow
        data['isFollowing'] = Follow.objects.filter(
            follower=request.user, following_id=v.creator_id
        ).exists()
    else:
        data['isFollowing'] = False

    cache.set(ck, data, 30)   # 30 s — stale on like/bookmark is fine
    return Response(data)


@api_view(['GET'])
@permission_classes([AllowAny])
def video_hls_status(request, video_id):
    """HLS dönüştürme durumunu ve URL'yi döndürür. Polling için kullanılır."""
    from .utils import resolve_video
    video = resolve_video(video_id)
    if not video:
        return Response({'error': 'Video bulunamadı'}, status=404)
    return Response({
        'status': getattr(video, 'hls_status', 'none'),
        'hlsUrl': video.hls_url,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def stream_video(request, video_id):
    """
    Video dosyasını backend üzerinden stream eder.
    - Yerel medya dosyaları (media/ klasörü): doğrudan range destekli servis
    - cloud.mail.ru URL'leri: CDN üzerinden proxy
    Range isteklerini destekler (video seeking için).
    """
    import requests as _rq
    from django.http import StreamingHttpResponse, FileResponse
    from django.conf import settings
    import mimetypes
    import os

    v = _resolve_video(video_id)
    if not v:
        return Response({'error': 'Video not found'}, status=404)

    # Önce: yerel dosya mı?
    local_file = None
    for candidate in [v.hls_url, v.video_url]:
        if not candidate:
            continue
        # /media/ ile başlayan göreli yol
        if candidate.startswith('/media/') or candidate.startswith('media/'):
            rel = candidate.lstrip('/')
            # MEDIA_ROOT üzerinden dene (daha güvenilir)
            try:
                media_rel = rel[len('media/'):] if rel.startswith('media/') else rel
                full_path = os.path.join(settings.MEDIA_ROOT, media_rel)
                if os.path.isfile(full_path):
                    local_file = full_path
                    break
            except Exception:
                pass
            # BASE_DIR üzerinden dene
            full_path = os.path.join(settings.BASE_DIR, rel)
            if os.path.isfile(full_path):
                local_file = full_path
                break
        # Mutlak yol mu?
        elif os.path.isabs(candidate) and os.path.isfile(candidate):
            local_file = candidate
            break

    if local_file:
        # Yerel dosyayı range destekli olarak sun
        mime_type, _ = mimetypes.guess_type(local_file)
        if not mime_type or not mime_type.startswith('video/'):
            # Uzantıya göre tahmin
            ext = os.path.splitext(local_file)[1].lower()
            mime_map = {
                '.mp4': 'video/mp4', '.webm': 'video/webm',
                '.ogg': 'video/ogg', '.ogv': 'video/ogg',
                '.mov': 'video/mp4', '.mkv': 'video/mp4',
                '.avi': 'video/mp4', '.flv': 'video/mp4',
                '.wmv': 'video/mp4', '.ts': 'video/mp2t',
                '.m3u8': 'application/vnd.apple.mpegurl',
                '.mpg': 'video/mpeg', '.mpeg': 'video/mpeg',
                '.3gp': 'video/3gpp', '.3g2': 'video/3gpp2',
            }
            mime_type = mime_map.get(ext, 'video/mp4')

        file_size = os.path.getsize(local_file)
        range_header = request.META.get('HTTP_RANGE', '').strip()

        if range_header:
            # Range request — video seeking için kritik
            try:
                range_str = range_header.replace('bytes=', '')
                range_start, range_end = range_str.split('-')
                range_start = int(range_start)
                range_end = int(range_end) if range_end else file_size - 1
                range_end = min(range_end, file_size - 1)
                length = range_end - range_start + 1

                def file_iterator(path, start, chunk=512 * 1024):
                    with open(path, 'rb') as f:
                        f.seek(start)
                        remaining = length
                        while remaining > 0:
                            data = f.read(min(chunk, remaining))
                            if not data:
                                break
                            remaining -= len(data)
                            yield data

                resp = StreamingHttpResponse(
                    file_iterator(local_file, range_start),
                    status=206,
                    content_type=mime_type,
                )
                resp['Content-Range'] = f'bytes {range_start}-{range_end}/{file_size}'
                resp['Content-Length'] = str(length)
                resp['Accept-Ranges'] = 'bytes'
                resp['Access-Control-Allow-Origin'] = '*'
                resp['Access-Control-Expose-Headers'] = 'Content-Range, Accept-Ranges, Content-Length'
                return resp
            except Exception:
                pass  # Hatalı range → tam dosyayı sun

        # Tam dosya
        resp = FileResponse(open(local_file, 'rb'), content_type=mime_type)
        resp['Content-Length'] = str(file_size)
        resp['Accept-Ranges'] = 'bytes'
        resp['Access-Control-Allow-Origin'] = '*'
        resp['Access-Control-Expose-Headers'] = 'Content-Range, Accept-Ranges, Content-Length'
        return resp

    # Proxy edilecek URL'yi belirle: önce cloud.mail.ru, sonra herhangi bir HTTP URL
    url = None
    for candidate in [v.hls_url, v.video_url]:
        if candidate and 'cloud.mail.ru/public/' in candidate:
            url = candidate
            break

    # cloud.mail.ru değilse — herhangi bir HTTP(S) video URL'sini proxy et
    if not url:
        for candidate in [v.hls_url, v.video_url]:
            if candidate and (candidate.startswith('http://') or candidate.startswith('https://')):
                url = candidate
                break

    if not url:
        return Response({
            'error': 'Stream edilebilir video kaynağı bulunamadı',
            'detail': (
                'Bu videoya ait video_url, hls_url veya tamamlanmış crosspost stream URL\'i yok. '
                'Admin paneli → Video Yönetimi → Düzenle → video_url alanını doldurun '
                'veya Dağıtım sekmesinden crosspost yapın.'
            ),
            'video_id': video_id,
        }, status=400)

    # Doğrudan HTTP URL proxy'si (cloud.mail.ru olmayan)
    if url and 'cloud.mail.ru/public/' not in url:
        import re as _re
        import urllib.parse as _up

        # Dış CDN URL'leri (mp4, m3u8, webm vb.) → tarayıcıyı direkt yönlendir.
        # Sunucu üzerinden proxy'leme YAPMIYORUZ:
        #   - Her proxy stream bir Waitress thread'ini tutar → 3 kullanıcı = 3 thread bloke
        #   - Sunucu bantını 2 katı kullanır (CDN→sunucu + sunucu→kullanıcı)
        #   - Tarayıcı CDN'e direkt bağlanırsa çok daha hızlı
        from django.http import HttpResponseRedirect
        return HttpResponseRedirect(url)

    # Önce cache'deki çözümlenmiş URL'i dene
    resolved = _resolve_cloudmail_url(url)

    if not resolved or resolved == url:
        # Cache'de yok ya da çözümlenemedi — doğrudan CDN URL'ini bulmayı dene
        try:
            import urllib.parse
            headers = {
                'User-Agent': (
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                    'AppleWebKit/537.36 (KHTML, like Gecko) '
                    'Chrome/120.0.0.0 Safari/537.36'
                ),
                'Accept-Language': 'tr-TR,tr;q=0.9',
            }
            session = _rq.Session()
            page = session.get(url, headers=headers, timeout=15)
            html = page.text

            # Birden fazla JSON formatını dene
            base_url = None
            for pattern in [
                r'"weblink_view"\s*:\s*\{"count"\s*:\s*"\d+"\s*,\s*"url"\s*:\s*"([^"]+)"',
                r'"weblink_view"\s*:\s*\{[^}]*"url"\s*:\s*"([^"]+)"',
                r'cloclo\d+\.cloud\.mail\.ru/weblink/[^\s"\'<>]+',
            ]:
                m = re.search(pattern, html)
                if m:
                    base_url = m.group(1) if '(' in pattern else m.group(0)
                    break

            if base_url:
                parsed = urllib.parse.urlparse(url)
                weblink_path = parsed.path.split('/public/', 1)[-1]
                # base_url zaten tam URL ise direkt kullan, değilse path ekle
                if base_url.startswith('http') and 'weblink' in base_url and not base_url.endswith('/'):
                    resolved = base_url + '/' + weblink_path
                elif base_url.startswith('http'):
                    resolved = base_url + weblink_path
                else:
                    resolved = url  # çözümlenemedi
        except Exception:
            resolved = url

    if not resolved or resolved == url:
        return Response({'error': 'cloud.mail.ru CDN adresi çözümlenemedi'}, status=422)

    # Range header desteği (video seeking)
    upstream_headers = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/120.0.0.0 Safari/537.36'
        ),
    }
    range_header = request.META.get('HTTP_RANGE')
    if range_header:
        upstream_headers['Range'] = range_header

    def _fetch_upstream(target_url):
        return _rq.get(
            target_url,
            headers=upstream_headers,
            stream=True,
            timeout=30,
            allow_redirects=True,
        )

    try:
        upstream = _fetch_upstream(resolved)
    except Exception as e:
        return Response({'error': f'Stream hatası: {str(e)}'}, status=502)

    # CDN token'ı süresi dolmuşsa (403) — cache'i temizle ve yeniden çöz
    if upstream.status_code in (403, 401, 410):
        try:
            upstream.close()
        except Exception:
            pass
        cache_key = f'cloudmail_cdn_{hash(url)}'
        cache.delete(cache_key)
        fresh = _resolve_cloudmail_url(url)
        if fresh and fresh != url and fresh != resolved:
            try:
                upstream = _fetch_upstream(fresh)
                resolved = fresh
            except Exception as e:
                return Response({'error': f'Stream yenileme hatası: {str(e)}'}, status=502)
        else:
            return Response({'error': 'CDN bağlantısı reddedildi, lütfen daha sonra tekrar deneyin'}, status=503)

    content_type = upstream.headers.get('Content-Type', 'video/mp4')
    status_code = upstream.status_code

    def generate():
        for chunk in upstream.iter_content(chunk_size=524288):  # 512 KB
            if chunk:
                yield chunk

    resp = StreamingHttpResponse(generate(), content_type=content_type, status=status_code)
    resp['Accept-Ranges'] = 'bytes'
    for h in ['Content-Length', 'Content-Range']:
        if h in upstream.headers:
            resp[h] = upstream.headers[h]
    resp['Cache-Control'] = 'public, max-age=3600'
    resp['Access-Control-Allow-Origin'] = '*'
    resp['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
    resp['Access-Control-Allow-Headers'] = 'Range, Content-Type'
    resp['Access-Control-Expose-Headers'] = 'Content-Range, Accept-Ranges, Content-Length'
    return resp


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

    _title = data.get('title', 'Başlıksız Video')
    video = Video.objects.create(
        title=_title,
        slug=_make_slug(_title),
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
    # M2M kategoriler
    category_ids = data.get('categoryIds') or []
    if category_ids:
        from apps.videos.models import Category as _Cat
        video.categories.set(_Cat.objects.filter(id__in=category_ids))
    elif video.category_id:
        video.categories.set([video.category_id])
    from django.db.models import F
    from django.contrib.auth import get_user_model as _get_user_model
    _get_user_model().objects.filter(id=user.id).update(video_count=F('video_count') + 1)

    # Kendi Oynatıcı kapalıysa video_url / hls_url'i temizle (crosspost'tan sonra)
    save_to_own_player = data.get('saveToOwnPlayer', data.get('save_to_own_player', True))

    # Thumbnail yoksa otomatik üret (arka planda) — video_url temizlenmeden ÖNCE çağır
    try:
        from apps.videos.thumbnail_utils import auto_generate_thumbnail_async
        auto_generate_thumbnail_async(video)
    except Exception:
        pass

    # Cross-posting: video eklenince otomatik olarak auto_post=True sitelere gönder
    try:
        site_ids = data.get('crossPostSiteIds')
        auto_flag = data.get('autoCrossPost', True)  # Varsayılan True — her zaman otomatik
        send_all = bool(data.get('autoCrossPostAll', False)) and not site_ids
        # site_ids verilmişse yalnızca onlara, verilmemişse auto_post=True sitelere gönder
        from apps.crosspost.dispatcher import dispatch_for_video
        import threading
        def _dispatch_async():
            try:
                dispatch_for_video(video, user, site_ids, send_all=send_all)
            except Exception:
                pass
        threading.Thread(target=_dispatch_async, daemon=True).start()
    except Exception:
        pass

    # Crosspost jobs kuyruğa alındıktan sonra kendi oynatıcıyı temizle
    if not save_to_own_player:
        Video.objects.filter(id=video.id).update(video_url=None, hls_url=None)
        video.video_url = None
        video.hls_url = None

    # Harici URL varsa arka planda sunucuya indir (embed asla kullanılmayacak)
    try:
        _url = video.video_url or video.hls_url or ''
        if _url and (_url.startswith('http://') or _url.startswith('https://')):
            _download_any_url_to_server(video.id)
    except Exception:
        pass

    # Auto-distribute to active providers in background
    try:
        _distribute_video_background(video.id)
    except Exception:
        pass

    return Response(enrich_video(video), status=201)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_video(request, video_id):
    video = _resolve_video(video_id)
    if not video:
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

    new_title = data.get('title')
    if new_title and new_title != video.title:
        video.slug = _make_slug(new_title, exclude_id=video.pk)

    for field, value in {
        'title': new_title,
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
    cache.delete(HOME_CACHE_KEY)
    cache.delete('init_anon:v1')
    # M2M kategoriler güncelle
    category_ids_upd = data.get('categoryIds')
    if category_ids_upd is not None:
        from apps.videos.models import Category as _Cat2
        video.categories.set(_Cat2.objects.filter(id__in=category_ids_upd))
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
    video = _resolve_video(video_id)
    if not video:
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
    video = _resolve_video(video_id)
    if not video:
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
    video = _resolve_video(video_id)
    if not video:
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
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video not found'}, status=404)
    if video.creator != request.user and request.user.role != 'admin':
        return Response({'error': 'Forbidden'}, status=403)
    video.delete()
    return Response({'message': 'Video deleted'})


@api_view(['POST'])
@permission_classes([AllowAny])
def guest_like_video(request, video_id):
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video not found'}, status=404)
    Video.objects.filter(id=video.id).update(guest_like_count=F('guest_like_count') + 1)
    video.refresh_from_db(fields=['guest_like_count'])
    return Response({'guestLikeCount': video.guest_like_count})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def like_video(request, video_id):
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video not found'}, status=404)
    like, created = VideoLike.objects.get_or_create(user=request.user, video=video)
    if created:
        Video.objects.filter(id=video.id).update(like_count=F('like_count') + 1)
        try:
            from apps.ai.views import record_event
            record_event('engagement', video=video, user=request.user, payload={'kind': 'likes'})
        except Exception:
            pass
    cache.delete(f'video_detail:{video.pk}:{request.user.id}')
    return Response({'isLiked': True, 'likeCount': video.like_count + (1 if created else 0)})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def unlike_video(request, video_id):
    video = _resolve_video(video_id)
    if not video:
        return Response({'isLiked': False})
    deleted, _ = VideoLike.objects.filter(user=request.user, video=video).delete()
    if deleted:
        Video.objects.filter(id=video.id).update(like_count=F('like_count') - 1)
    cache.delete(f'video_detail:{video.pk}:{request.user.id}')
    return Response({'isLiked': False})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bookmark_video(request, video_id):
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video not found'}, status=404)
    VideoBookmark.objects.get_or_create(user=request.user, video=video)
    cache.delete(f'video_detail:{video.pk}:{request.user.id}')
    return Response({'isBookmarked': True})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def unbookmark_video(request, video_id):
    video = _resolve_video(video_id)
    if video:
        VideoBookmark.objects.filter(user=request.user, video=video).delete()
        cache.delete(f'video_detail:{video.pk}:{request.user.id}')
    return Response({'isBookmarked': False})


@api_view(['POST'])
@permission_classes([AllowAny])
def record_view(request, video_id):
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video not found'}, status=404)
    Video.objects.filter(id=video.id).update(view_count=F('view_count') + 1)
    watch_time = request.data.get('watchTime', request.data.get('watch_time', 0))
    completion_rate = request.data.get('completionRate', request.data.get('completion_rate', 0))
    if request.user.is_authenticated:
        wh, created = WatchHistory.objects.get_or_create(user=request.user, video=video)
        # Her iki durumda da watch_time ve completion_rate güncelle
        update_wt = int(watch_time or 0)
        update_cr = int(completion_rate or 0)
        if update_wt > 0 or update_cr > 0:
            # Sadece daha büyük değer gelirse güncelle (geri alma)
            if update_wt >= wh.watch_time or update_cr >= wh.completion_rate:
                wh.watch_time = update_wt
                wh.completion_rate = update_cr
                wh.save(update_fields=['watch_time', 'completion_rate', 'updated_at'])
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


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def video_heatmap(request, video_id):
    """
    GET  → normalize edilmiş 100-segmentlik ısı haritası döner.
    POST → kullanıcının izlediği segmentleri birikimli sayaca ekler.
    """
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video bulunamadı'}, status=404)

    from apps.videos.models import VideoHeatmap

    if request.method == 'GET':
        try:
            hm = video.heatmap
            segs = hm.segments if isinstance(hm.segments, list) and len(hm.segments) == 100 else [0] * 100
            total = hm.total_sessions
        except Exception:
            segs = [0] * 100
            total = 0
        max_val = max(segs) if segs and max(segs) > 0 else 1
        normalized = [round(v / max_val, 3) for v in segs]
        return Response({'segments': normalized, 'totalSessions': total})

    # ── POST ──────────────────────────────────────────────────────────
    segments_watched = request.data.get('segments', [])
    watch_time = int(request.data.get('watchTime', 0) or 0)
    completion_rate = int(request.data.get('completionRate', 0) or 0)
    milestones = request.data.get('milestones', [])

    if isinstance(segments_watched, list) and len(segments_watched) == 100:
        from django.db import transaction
        with transaction.atomic():
            hm, _ = VideoHeatmap.objects.select_for_update().get_or_create(
                video=video,
                defaults={'segments': [0] * 100}
            )
            current = hm.segments if isinstance(hm.segments, list) and len(hm.segments) == 100 else [0] * 100
            for i, watched in enumerate(segments_watched):
                if watched:
                    current[i] += 1
            hm.segments = current
            hm.total_sessions += 1
            hm.save()

    # WatchHistory güncelle (giriş yapmış kullanıcı için)
    if request.user.is_authenticated and (watch_time > 0 or completion_rate > 0):
        pause_count    = int(request.data.get('pauseCount', 0) or 0)
        seek_count     = int(request.data.get('seekCount', 0) or 0)
        replay_count   = int(request.data.get('replayCount', 0) or 0)
        quality_chg    = int(request.data.get('qualityChanges', 0) or 0)
        last_position  = int(request.data.get('lastPosition', 0) or 0)

        wh, created = WatchHistory.objects.get_or_create(user=request.user, video=video)
        update_fields = ['updated_at']

        if watch_time >= wh.watch_time or completion_rate >= wh.completion_rate:
            wh.watch_time = max(wh.watch_time, watch_time)
            wh.completion_rate = max(wh.completion_rate, completion_rate)
            update_fields += ['watch_time', 'completion_rate']

        # Accumulate per-session engagement signals
        if pause_count > 0:
            wh.pause_count += pause_count
            update_fields.append('pause_count')
        if seek_count > 0:
            wh.seek_count += seek_count
            update_fields.append('seek_count')
        if replay_count > 0:
            wh.replay_count += replay_count
            update_fields.append('replay_count')
        if quality_chg > 0:
            wh.quality_changes += quality_chg
            update_fields.append('quality_changes')
        if last_position > 0:
            wh.last_position = last_position
            update_fields.append('last_position')
        # Only count a new session when > 30 min has passed since last activity.
        # The player posts heatmap every ~15 s, so without this guard every poll
        # would inflate session_count.
        if not created:
            from django.utils import timezone
            gap = (timezone.now() - wh.updated_at).total_seconds()
            if gap > 1800:  # 30 minutes
                wh.session_count += 1
                update_fields.append('session_count')

        wh.save(update_fields=list(set(update_fields)))

    # Milestone AI olayları
    if milestones:
        try:
            from apps.ai.views import record_event
            for ms in milestones:
                record_event('watch_milestone', video=video,
                             user=request.user if request.user.is_authenticated else None,
                             payload={'milestone': ms})
        except Exception:
            pass

    return Response({'ok': True})


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
        'videos': [enrich_video(b.video, request.user) for b in items],
        'total': total,
        'page': page,
        'limit': limit,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def list_categories(request):
    cached = cache.get('categories:all_v3')
    if cached is not None:
        resp = Response(cached)
        resp['Cache-Control'] = 'public, s-maxage=300, max-age=300, stale-while-revalidate=120'
        return resp
    result = _categories_with_stats()
    cache.set('categories:all_v3', result, 300)
    resp = Response(result)
    resp['Cache-Control'] = 'public, s-maxage=300, max-age=300, stale-while-revalidate=120'
    return resp


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

    popularity_expr = ExpressionWrapper(
        F('view_count') + F('like_count') * 5 + F('comment_count') * 8,
        output_field=IntegerField()
    )
    top_video = (
        Video.objects.filter(category=cat, is_published=True)
        .annotate(popularity=popularity_expr)
        .order_by('-popularity', '-created_at')
        .values('thumbnail_url')
        .first()
    )
    cover_image = top_video['thumbnail_url'] if top_video else None

    return Response({
        'category': {
            'id': cat.id, 'name': cat.name, 'slug': cat.slug, 'iconUrl': cat.icon_url,
            'videoCount': total, 'coverImage': cover_image,
        },
        'videos': enrich_videos_bulk(videos, request.user),
        'total': total,
    })


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def list_comments(request, video_id):
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video not found'}, status=404)

    if request.method == 'POST':
        if not request.user or not request.user.is_authenticated:
            return Response({'error': 'Authentication required'}, status=401)
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
        Video.objects.filter(id=video.id).update(comment_count=F('comment_count') + 1)
        return Response(_fmt_comment(comment), status=201)

    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    comments = Comment.objects.filter(video_id=video.id, parent=None).select_related('author').order_by('-created_at')
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
    video = _resolve_video(video_id)
    if not video:
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
    Video.objects.filter(id=video.id).update(comment_count=F('comment_count') + 1)
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
    is_hls = ext in {'.m3u8', '.m3u'}

    # Return the URL only — the caller (create_video / admin form) will create the Video record.
    # We intentionally do NOT create a Video here to avoid duplicate records.
    return Response({
        'message': 'Dosya yüklendi',
        'url': local_url,
        'hlsUrl': local_url if is_hls else None,
        'filename': filename,
        'isHls': is_hls,
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
    """Gerçekten ilgili videoları döndürür: aynı kategori/etiket/kanal benzerliği
    (içerik tabanlı) + bu videoyu izleyen diğer kullanıcıların izlediği diğer
    videolar (işbirlikçi filtreleme — "bunu izleyenler şunu da izledi").
    İki sinyal ağırlıklı olarak birleştirilip alakasız videolar elenir."""
    limit = min(int(request.query_params.get('limit', 10)), 20)
    video = _resolve_video(video_id)
    if not video:
        return Response({'videos': []})

    video_tags = set(video.tags or [])

    # ── İçerik tabanlı adaylar: aynı kategori, aynı yaratıcı veya ortak etiket ──
    tag_q = Q()
    for t in video_tags:
        tag_q |= Q(tags__icontains=t)
    content_filter = Q(category=video.category) | Q(creator=video.creator)
    if video_tags:
        content_filter |= tag_q

    content_candidates = list(
        Video.objects.filter(content_filter, is_published=True)
        .exclude(id=video.id)
        .select_related('creator', 'category')[:200]
    )

    # ── İşbirlikçi filtreleme: bu videoyu izleyen kullanıcıların izlediği diğer videolar ──
    co_watch_scores = {}
    viewer_ids = list(
        WatchHistory.objects.filter(video_id=video.id)
        .values_list('user_id', flat=True).distinct()[:500]
    )
    co_watch_videos = {}
    if viewer_ids:
        co_rows = (
            WatchHistory.objects.filter(user_id__in=viewer_ids)
            .exclude(video_id=video.id)
            .values('video_id', 'user_id', 'completion_rate')
        )
        for row in co_rows:
            vid = row['video_id']
            strength = 0.4 + 0.6 * (min(100, row.get('completion_rate') or 0) / 100)
            co_watch_scores[vid] = co_watch_scores.get(vid, 0) + strength

        if co_watch_scores:
            top_co_ids = sorted(co_watch_scores, key=co_watch_scores.get, reverse=True)[:100]
            co_watch_videos = {
                v.id: v for v in Video.objects.filter(
                    id__in=top_co_ids, is_published=True,
                ).select_related('creator', 'category')
            }

    # ── Skorlama: içerik benzerliği + ortak izlenme gücünü birleştir ──
    max_co = max(co_watch_scores.values()) if co_watch_scores else 1
    merged = {v.id: v for v in content_candidates}
    merged.update(co_watch_videos)

    def score(v):
        content_s = 0.0
        if v.category_id and v.category_id == video.category_id:
            content_s += 0.45
        if v.creator_id == video.creator_id:
            content_s += 0.25
        if video_tags:
            overlap = len(video_tags & set(v.tags or []))
            content_s += 0.30 * (overlap / len(video_tags))
        co_s = (co_watch_scores.get(v.id, 0) / max_co) if v.id in co_watch_scores else 0
        # Sadece işbirlikçi sinyali olan ama içerikle hiç alakası olmayan
        # videoları da değerli kabul ediyoruz, ama içerik + co-watch birleşimi
        # en alakalı sonuçları öne çıkarır.
        return content_s * 0.6 + co_s * 0.4

    ranked = sorted(merged.values(), key=score, reverse=True)
    # Skoru sıfır olan (ne kategori/kanal/etiket eşleşmesi ne de ortak izlenme
    # sinyali olan) videoları ele — gerçekten alakasız içerik gösterme.
    ranked = [v for v in ranked if score(v) > 0][:limit]
    return Response({'videos': enrich_videos_bulk(ranked, request.user)})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_video_subtitles(request, video_id):
    video = _resolve_video(video_id)
    if not video:
        return Response({'subtitles': []})
    subs = VideoSubtitle.objects.filter(video_id=video.id)
    return Response({'subtitles': [{
        'id': s.id, 'language': s.language, 'label': s.label, 'isAutoGenerated': s.is_auto_generated
    } for s in subs]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_subtitle(request, video_id):
    video = _resolve_video(video_id)
    if not video:
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


# ─── Video Distribution to Providers ──────────────────────────────────────────

def _submit_to_provider(integration, video_url, video_title):
    """Submit video URL to a provider for remote download. Returns embed_url or None."""
    import urllib.request
    import urllib.parse
    import json as _json
    platform = integration.platform
    name = urllib.parse.quote(video_title[:80])
    encoded_url = urllib.parse.quote(video_url, safe='')

    try:
        if platform == 'streamtape' and integration.login and integration.key:
            api = f'https://api.streamtape.com/remotedl?login={integration.login}&key={integration.key}&url={encoded_url}&name={name}'
            with urllib.request.urlopen(api, timeout=15) as r:
                d = _json.loads(r.read().decode())
                if d.get('status') == 200:
                    file_id = d.get('result', {}).get('id', '')
                    return f'https://streamtape.com/e/{file_id}' if file_id else None

        elif platform == 'doodstream' and integration.api_key:
            api = f'https://doodapi.com/api/upload/url?key={integration.api_key}&url={encoded_url}&filename={name}'
            with urllib.request.urlopen(api, timeout=15) as r:
                d = _json.loads(r.read().decode())
                if d.get('status') == 200:
                    filecode = d.get('result', {}).get('filecode', '')
                    return f'https://doodstream.com/e/{filecode}' if filecode else None

        elif platform == 'mixdrop' and integration.api_key and integration.email:
            post_data = urllib.parse.urlencode({'url': video_url, 'key': integration.api_key, 'email': integration.email}).encode()
            req = urllib.request.Request('https://ul.mixdrop.ag/api/upload/url', data=post_data, method='POST')
            with urllib.request.urlopen(req, timeout=15) as r:
                d = _json.loads(r.read().decode())
                ref = (d.get('result') or {}).get('ref', '')
                return f'https://mixdrop.ag/e/{ref}' if ref else None

        elif integration.api_key:
            # Generic API-key platforms: POST to /api/upload/url with key+url
            PROVIDER_URL_MAP = {
                # Video streaming hosts
                'streamwish':   ('api.streamwish.com',   'streamwish.com'),
                'vidhide':      ('vidhide.com',           'vidhide.com'),
                'voe':          ('voe.sx',                'voe.sx'),
                'upstream':     ('upstream.to',           'upstream.to'),
                'luluvdo':      ('luluvdo.com',           'luluvdo.com'),
                'streamhide':   ('streamhide.com',        'streamhide.com'),
                'supervideo':   ('supervideo.tv',         'supervideo.tv'),
                'filemoon':     ('filemoonapi.com',       'filemoon.sx'),
                'hxfile':       ('hxfile.ch',             'hxfile.ch'),
                'vidplay':      ('vidplay.online',        'vidplay.online'),
                'nxbex':        ('nxbex.com',             'nxbex.com'),
                'dropgalaxy':   ('dropgalaxy.com',        'dropgalaxy.com'),
                'evoload':      ('evoload.io',            'evoload.io'),
                'streamsb':     ('streamsb.net',          'streamsb.net'),
                'uqload':       ('uqload.io',             'uqload.io'),
                'embedsito':    ('embedsito.com',         'embedsito.com'),
                'vidlox':       ('vidlox.me',             'vidlox.me'),
                'clipwatching': ('clipwatching.com',      'clipwatching.com'),
                'dropload':     ('dropload.io',           'dropload.io'),
                'streamlare':   ('streamlare.com',        'streamlare.com'),
                'fembed':       ('www.fembed.com',        'www.fembed.com'),
                'hotlinking':   ('hotlinking.co',         'hotlinking.co'),
                'filelions':    ('filelions.com',         'filelions.com'),
                'vidmoly':      ('vidmoly.to',            'vidmoly.to'),
                'streamhub':    ('streamhub.to',          'streamhub.to'),
                'videovard':    ('videovard.sx',          'videovard.sx'),
                'waaw':         ('waaw.tv',               'waaw.tv'),
                'upvid':        ('upvid.co',              'upvid.co'),
                'vtube':        ('vtube.network',         'vtube.network'),
                'abysscdn':     ('abysscdn.com',          'abysscdn.com'),
                'filebee':      ('filebee.to',            'filebee.to'),
                'vipfile':      ('vipfile.cc',            'vipfile.cc'),
                'vidmam':       ('vidmam.com',            'vidmam.com'),
                'moonvid':      ('moonvid.cc',            'moonvid.cc'),
                'gobig':        ('gobig.cc',              'gobig.cc'),
                'jetload':      ('jetload.net',           'jetload.net'),
                'sendvid':      ('sendvid.com',           'sendvid.com'),
                'rapidvideo':   ('rapidvideo.com',        'rapidvideo.com'),
                'vidcrypt':     ('vidcrypt.com',          'vidcrypt.com'),
                'embedrise':    ('embedrise.com',         'embedrise.com'),
                'kvid':         ('kvid.pro',              'kvid.pro'),
                'megaup':       ('megaup.net',            'megaup.net'),
                'vidoza':       ('vidoza.net',            'vidoza.net'),
                'streamff':     ('streamff.com',          'streamff.com'),
                'vudeo':        ('vudeo.co',              'vudeo.co'),
                'gofile':       ('gofile.io',             'gofile.io'),
                'videobin':     ('videobin.co',           'videobin.co'),
                'mp4upload':    ('www.mp4upload.com',     'www.mp4upload.com'),
                'verystream':   ('verystream.com',        'verystream.com'),
                'embedv':       ('embedv.net',            'embedv.net'),
                'cloudvideo':   ('cloudvideo.tv',         'cloudvideo.tv'),
                'streamwo':     ('streamwo.com',          'streamwo.com'),
                'gounlimited':  ('gounlimited.to',        'gounlimited.to'),
            }
            if platform in PROVIDER_URL_MAP:
                api_host, embed_host = PROVIDER_URL_MAP[platform]
                api = f'https://{api_host}/api/upload/url?key={integration.api_key}&url={encoded_url}&filename={name}'
                with urllib.request.urlopen(api, timeout=15) as r:
                    d = _json.loads(r.read().decode())
                    if d.get('status') == 200:
                        result = d.get('result', {})
                        filecode = result.get('filecode') or result.get('file_code') or result.get('id', '')
                        if filecode:
                            return f'https://{embed_host}/e/{filecode}'
        return None
    except Exception:
        return None


def _distribute_video_background(video_id):
    """Run in background thread — distribute video to all active auto-upload providers."""
    import threading
    import django
    django.setup() if not django.apps.registry.apps.ready else None

    def _run():
        try:
            from apps.admin_panel.models import IntegrationConfig
            video = Video.objects.select_related('creator').get(id=video_id)
            video_url = video.video_url or video.hls_url
            if not video_url:
                return
            # Make absolute URL if relative
            if video_url.startswith('/'):
                from django.conf import settings as _s
                host = getattr(_s, 'SITE_URL', None) or os.environ.get('REPLIT_DEV_DOMAIN', 'http://localhost:8000')
                if host and not host.startswith('http'):
                    host = 'https://' + host
                video_url = host.rstrip('/') + video_url

            active = IntegrationConfig.objects.filter(is_active=True, auto_upload=True)
            for intg in active:
                existing = VideoPlayer.objects.filter(video=video, label__icontains=intg.name).exists()
                if existing:
                    continue
                embed_url = _submit_to_provider(intg, video_url, video.title)
                if embed_url:
                    VideoPlayer.objects.create(
                        video=video,
                        label=intg.name,
                        embed_url=embed_url,
                        player_type='iframe',
                        is_default=False,
                    )
                    IntegrationConfig.objects.filter(id=intg.id).update(
                        upload_count=F('upload_count') + 1
                    )
        except Exception:
            pass

    t = threading.Thread(target=_run, daemon=True)
    t.start()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def distribute_video(request, video_id):
    """Manually trigger distribution of a video to all active providers."""
    if request.user.role not in ('admin', 'moderator', 'creator'):
        return Response({'error': 'Forbidden'}, status=403)
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video not found'}, status=404)
    if video.creator != request.user and request.user.role not in ('admin', 'moderator'):
        return Response({'error': 'Forbidden'}, status=403)

    from apps.admin_panel.models import IntegrationConfig
    active = IntegrationConfig.objects.filter(is_active=True, auto_upload=True)
    count = active.count()

    _distribute_video_background(video.id)
    return Response({'message': f'{count} sağlayıcıya dağıtım başlatıldı', 'count': count})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resolve_video_url(request):
    """
    Verilen URL'yi doğrudan oynatılabilir video URL'sine çözümler.
    Şu an desteklenen: cloud.mail.ru paylaşım linkleri.
    """
    import urllib.parse
    import requests as _requests

    raw_url = (request.data.get('url') or '').strip()
    if not raw_url:
        return Response({'error': 'URL gerekli'}, status=400)

    # ── cloud.mail.ru ────────────────────────────────────────────────────────
    if 'cloud.mail.ru/public/' in raw_url:
        try:
            headers = {
                'User-Agent': (
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                    'AppleWebKit/537.36 (KHTML, like Gecko) '
                    'Chrome/120.0.0.0 Safari/537.36'
                ),
                'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            }
            session = _requests.Session()

            # Paylaşım sayfasını al
            page = session.get(raw_url, headers=headers, timeout=15)
            page.raise_for_status()
            html = page.text

            # weblink_view base URL'ini HTML'deki JSON'dan çıkart
            base_match = re.search(
                r'"weblink_view"\s*:\s*\{"count"\s*:\s*"\d+"\s*,\s*"url"\s*:\s*"([^"]+)"',
                html
            )
            if not base_match:
                return Response({'error': 'cloud.mail.ru CDN adresi bulunamadı'}, status=422)

            base_url = base_match.group(1)  # e.g. https://cloclo62.cloud.mail.ru/weblink/view/

            # Weblink path = URL'deki /public/ sonrası kısım
            parsed = urllib.parse.urlparse(raw_url)
            path_parts = parsed.path.split('/public/', 1)
            if len(path_parts) < 2:
                return Response({'error': 'Geçersiz cloud.mail.ru linki'}, status=422)

            weblink_path = path_parts[1]  # e.g. 7g3t/haM7PhGho/Video.mp4

            # CDN URL'ini oluştur ve GET yap (redirect'i takip et)
            cdn_url = base_url + weblink_path
            cdn_resp = session.get(cdn_url, headers=headers, stream=True, timeout=20, allow_redirects=True)

            ct = cdn_resp.headers.get('Content-Type', '')
            if cdn_resp.status_code == 200 and ('video' in ct or 'octet' in ct):
                return Response({'url': cdn_resp.url, 'contentType': ct})

            return Response(
                {'error': f'CDN erişimi başarısız: HTTP {cdn_resp.status_code}'},
                status=422
            )

        except Exception as exc:
            return Response({'error': f'Çözümleme hatası: {str(exc)}'}, status=500)

    # ── Desteklenmeyen ───────────────────────────────────────────────────────
    return Response(
        {'error': 'Bu URL türü desteklenmiyor. Şu an sadece cloud.mail.ru linkleri çözümlenir.'},
        status=400
    )


# ── Evrensel video indirme: HERHANGİ bir URL → media/uploads/ ────────────────

def _download_any_url_to_server(video_id):
    """
    Arka planda HERHANGİ bir HTTP/HTTPS URL'ini çözümleyip dosyayı media/uploads/'a indirir.
    İndirme durumunu cache'de tutar:
      video_dl_{video_id}: pending | downloading | done | error:<msg>
      video_dl_pct_{video_id}: 0-100
    """
    import threading

    def _run():
        import uuid as _uuid
        import requests as _rq
        from urllib.parse import urlparse
        from django.conf import settings as _s

        ck_status = f'video_dl_{video_id}'
        ck_pct    = f'video_dl_pct_{video_id}'
        cache.set(ck_status, 'downloading', 7200)
        cache.set(ck_pct, 0, 7200)

        UA = (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/124.0.0.0 Safari/537.36'
        )

        def _try_fetch(url, extra_headers=None):
            """URL'i çeşitli header kombinasyonlarıyla dener. (resp, hata_str) döner."""
            parsed = urlparse(url)
            origin  = f'{parsed.scheme}://{parsed.netloc}'
            referer = origin + '/'

            # Bilinen CDN'ler için özel Referer listesi
            known_referers = [referer]
            host = parsed.netloc.lower()
            # vwfastdelivery, leakvids, voe gibi CDN'ler için popüler kaynak siteleri dene
            if any(k in host for k in ['fastdelivery', 'fast-delivery', 'vwfast', 'leakvid', 'voe', 'vidoza', 'streamtape', 'doodstream']):
                known_referers += [
                    'https://vidoza.net/',
                    'https://voe.sx/',
                    'https://leakvids.com/',
                    'https://streamtape.com/',
                    'https://doodstream.com/',
                    '',  # Referer yok
                ]
            else:
                known_referers.append('')  # Referer yok

            header_variants = []
            for ref in known_referers:
                h = {
                    'User-Agent': UA,
                    'Accept': 'video/webm,video/ogg,video/*;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Sec-Fetch-Dest': 'video',
                    'Sec-Fetch-Mode': 'no-cors',
                    'Range': 'bytes=0-',
                }
                if ref:
                    h['Referer'] = ref
                    h['Origin'] = ref.rstrip('/')
                    h['Sec-Fetch-Site'] = 'cross-site'
                else:
                    h['Sec-Fetch-Site'] = 'none'
                header_variants.append(h)
            # Curl taklidi son çare olarak ekle
            header_variants.append({'User-Agent': 'curl/7.88.1', 'Accept': '*/*'})

            if extra_headers:
                header_variants.insert(0, {**header_variants[0], **extra_headers})

            last_status = 0
            last_err = ''
            for hdrs in header_variants:
                try:
                    r = _rq.get(
                        url, headers=hdrs, stream=True,
                        timeout=180, allow_redirects=True,
                        verify=True,
                    )
                    if r.status_code in (200, 206):
                        return r, ''
                    if r.status_code == 410:
                        return None, 'Dosya artık mevcut değil (410 Gone) — kaynak sunucudan silinmiş olabilir'
                    last_status = r.status_code
                    last_err = f'HTTP {r.status_code}'
                except Exception as e:
                    last_err = f'{type(e).__name__}: {e}'

            # Tüm header denemeleri başarısız — yt-dlp ile dene
            return None, last_err

        def _try_ytdlp(url, upload_dir, ck_pct):
            """yt-dlp ile indirmeyi dener. (local_path, local_url, hata_str) döner."""
            import subprocess, glob as _glob, shutil, sys
            import tempfile
            tmp_dir = tempfile.mkdtemp(prefix='ytdl_')
            try:
                out_tmpl = os.path.join(tmp_dir, '%(id)s.%(ext)s')
                cmd = [
                    sys.executable, '-m', 'yt_dlp',
                    '--no-playlist',
                    '--no-warnings',
                    '--quiet',
                    '--no-part',
                    '--format', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                    '--output', out_tmpl,
                    url,
                ]
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
                if proc.returncode != 0:
                    err = (proc.stderr or proc.stdout or '').strip()[-300:] or 'yt-dlp başarısız'
                    return None, None, f'yt-dlp: {err}'

                files = _glob.glob(os.path.join(tmp_dir, '*'))
                if not files:
                    return None, None, 'yt-dlp: dosya üretilmedi'

                src = files[0]
                ext = os.path.splitext(src)[1] or '.mp4'
                import uuid as _uuid2
                fname = f'{_uuid2.uuid4().hex}{ext}'
                dest = os.path.join(upload_dir, fname)
                shutil.move(src, dest)
                return dest, f'/media/uploads/{fname}', ''
            except subprocess.TimeoutExpired:
                return None, None, 'yt-dlp: indirme zaman aşımı (10 dk)'
            except Exception as e:
                return None, None, f'yt-dlp: {type(e).__name__}: {e}'
            finally:
                try:
                    import shutil as _sh; _sh.rmtree(tmp_dir, ignore_errors=True)
                except Exception:
                    pass

        try:
            video = Video.objects.get(id=video_id)
            raw_url = video.video_url or video.hls_url or ''

            if not raw_url or raw_url.startswith('/media/') or raw_url.startswith('media/'):
                cache.set(ck_status, 'done', 7200)
                return

            # cloud.mail.ru için CDN URL'ini önce çöz
            if 'cloud.mail.ru/public/' in raw_url:
                resolved = _resolve_cloudmail_url(raw_url)
                if resolved and resolved != raw_url:
                    raw_url = resolved

            upload_dir = os.path.join(_s.MEDIA_ROOT, 'uploads')
            os.makedirs(upload_dir, exist_ok=True)

            resp, http_err = _try_fetch(raw_url)

            if resp is not None:
                # ── Doğrudan HTTP indirme ─────────────────────────────────────
                total = int(resp.headers.get('Content-Length', 0)) or 0
                ct    = resp.headers.get('Content-Type', 'video/mp4').split(';')[0].strip().lower()

                ext = '.mp4'
                url_path = urlparse(resp.url).path.lower()
                for x in ['.mp4', '.webm', '.mkv', '.ogv', '.ogg', '.ts']:
                    if url_path.endswith(x):
                        ext = x
                        break
                else:
                    ct_map = {
                        'video/webm': '.webm', 'video/x-matroska': '.mkv',
                        'video/ogg': '.ogv', 'video/mp2t': '.ts',
                    }
                    ext = ct_map.get(ct, '.mp4')

                filename   = f'{_uuid.uuid4().hex}{ext}'
                local_path = os.path.join(upload_dir, filename)
                local_url  = f'/media/uploads/{filename}'

                downloaded = 0
                with open(local_path, 'wb') as fh:
                    for chunk in resp.iter_content(chunk_size=512 * 1024):
                        if chunk:
                            fh.write(chunk)
                            downloaded += len(chunk)
                            if total:
                                pct = int(downloaded * 100 / total)
                                cache.set(ck_pct, pct, 7200)

                if downloaded == 0:
                    try:
                        os.remove(local_path)
                    except Exception:
                        pass
                    # HTTP başarısız gibi davran, yt-dlp'ye düş
                    resp = None
                    http_err = 'Sunucu boş yanıt döndürdü'

            if resp is None:
                # ── yt-dlp fallback ───────────────────────────────────────────
                cache.set(ck_status, 'downloading', 7200)
                cache.set(ck_pct, 1, 7200)
                local_path, local_url, ytdlp_err = _try_ytdlp(raw_url, upload_dir, ck_pct)
                if local_path is None:
                    combined = f'{http_err} | yt-dlp: {ytdlp_err}' if http_err else ytdlp_err
                    cache.set(ck_status, f'error:{combined}', 7200)
                    return

            # ── Başarı ───────────────────────────────────────────────────────
            Video.objects.filter(id=video_id).update(video_url=local_url, hls_url=None)
            cache.set(ck_pct, 100, 7200)
            cache.set(ck_status, 'done', 7200)

            # Thumbnail yoksa üret
            try:
                from apps.videos.thumbnail_utils import auto_generate_thumbnail_async
                v2 = Video.objects.get(id=video_id)
                auto_generate_thumbnail_async(v2)
            except Exception:
                pass

        except Exception as exc:
            cache.set(ck_status, f'error:{exc}', 7200)

    threading.Thread(target=_run, daemon=True).start()


# Eski cloud.mail.ru fonksiyonu artık generic indiriciyi çağırır (geriye dönük uyumluluk)
def _fetch_video_to_server(video_id):
    _download_any_url_to_server(video_id)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def fetch_video_from_url(request, video_id):
    """Herhangi bir harici URL'i sunucuya indir ve video_url'i güncelle."""
    if request.user.role not in ('admin', 'moderator', 'creator'):
        return Response({'error': 'Yetki gerekli'}, status=403)

    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if video.creator != request.user and request.user.role not in ('admin', 'moderator'):
        return Response({'error': 'Forbidden'}, status=403)

    raw_url = video.video_url or video.hls_url or ''
    if not raw_url:
        return Response({'error': 'Bu video için kayıtlı URL yok'}, status=400)
    if raw_url.startswith('/media/') or raw_url.startswith('media/'):
        return Response({'status': 'done', 'message': 'Video zaten yerel'})

    ck = f'video_dl_{video.id}'
    current = cache.get(ck, '')
    if current in ('downloading', 'pending'):
        return Response({'status': current, 'message': 'İndirme zaten devam ediyor'})

    cache.set(ck, 'pending', 7200)
    cache.set(f'video_dl_pct_{video.id}', 0, 7200)
    _download_any_url_to_server(video.id)
    return Response({'status': 'pending', 'message': 'İndirme başlatıldı'})


@api_view(['GET'])
@permission_classes([AllowAny])
def fetch_video_status(request, video_id):
    """İndirme durumunu ve yüzdesini döner."""
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video bulunamadı'}, status=404)

    ck_status  = f'video_dl_{video.id}'
    ck_pct     = f'video_dl_pct_{video.id}'
    # Geriye dönük uyumluluk: eski cloud.mail.ru cache anahtarlarını da kontrol et
    status_val = cache.get(ck_status) or cache.get(f'cloudmail_dl_{video.id}')
    pct        = cache.get(ck_pct) or cache.get(f'cloudmail_dl_pct_{video.id}') or 0

    url   = video.video_url or video.hls_url or ''
    local = url.startswith('/media/') or url.startswith('media/')
    if local:
        status_val = 'done'

    error_msg = None
    if status_val and str(status_val).startswith('error:'):
        error_msg = str(status_val)[len('error:'):]

    return Response({
        'status': status_val,
        'percent': pct,
        'isLocal': local,
        'videoUrl': video.video_url,
        'errorMessage': error_msg,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_fetch_all_videos(request):
    """
    Sitedeki tüm harici URL'li videoları sunucuya indirir.
    Sadece admin/moderator kullanabilir.
    """
    if request.user.role not in ('admin', 'moderator'):
        return Response({'error': 'Admin yetkisi gerekli'}, status=403)

    videos = Video.objects.filter(is_published=True)
    queued = []
    skipped = []

    for video in videos:
        url = video.video_url or video.hls_url or ''
        if not url:
            skipped.append({'id': video.id, 'title': video.title, 'reason': 'URL yok'})
            continue
        if url.startswith('/media/') or url.startswith('media/'):
            skipped.append({'id': video.id, 'title': video.title, 'reason': 'Zaten yerel'})
            continue
        ck = f'video_dl_{video.id}'
        current = cache.get(ck, '')
        if current in ('downloading', 'pending'):
            skipped.append({'id': video.id, 'title': video.title, 'reason': 'İndirme devam ediyor'})
            continue
        cache.set(ck, 'pending', 7200)
        cache.set(f'video_dl_pct_{video.id}', 0, 7200)
        _download_any_url_to_server(video.id)
        queued.append({'id': video.id, 'title': video.title, 'url': url[:80]})

    return Response({
        'message': f'{len(queued)} video indirme kuyruğuna alındı',
        'queued': queued,
        'skipped': skipped,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bulk_generate_thumbnails(request):
    """
    Thumbnail'i olmayan tüm videolar için ffmpeg ile otomatik thumbnail üretir.
    video_url/hls_url boş olan videolar için crosspost stream URL'leri de denenir.
    Sadece admin/moderator kullanabilir.
    """
    if request.user.role not in ('admin', 'moderator'):
        return Response({'error': 'Admin yetkisi gerekli'}, status=403)

    from apps.videos.thumbnail_utils import auto_generate_thumbnail_async, _find_source_url

    videos = (
        Video.objects.filter(thumbnail_url__isnull=True) |
        Video.objects.filter(thumbnail_url='')
    ).distinct()

    total = videos.count()

    if total == 0:
        return Response({
            'message': 'Tüm videoların zaten thumbnail\'ı var.',
            'queued': 0,
            'skipped': 0,
            'skipped_reasons': [],
        })

    queued = 0
    skipped_reasons = []
    for video in videos:
        source = _find_source_url(video)
        if source is None:
            video_url = video.video_url or video.hls_url or ''
            if not video_url:
                reason = f'"{video.title[:40]}" — video_url boş'
            else:
                reason = f'"{video.title[:40]}" — dosya diskte bulunamadı ({video_url})'
            skipped_reasons.append(reason)
            continue
        auto_generate_thumbnail_async(video)
        queued += 1

    skipped = len(skipped_reasons)

    if queued == 0 and skipped > 0:
        message = (
            f'{skipped} video atlandı — video dosyaları sunucuda bulunamadı. '
            f'Dosyaları backend/media/uploads/ klasörüne kopyalayın, ardından tekrar deneyin.'
        )
    elif skipped == 0:
        message = f'{queued} video için thumbnail üretimi arka planda başlatıldı. Birkaç saniye içinde görünecek.'
    else:
        message = f'{queued} video kuyruğa alındı, {skipped} video atlandı (dosya bulunamadı).'

    return Response({
        'message': message,
        'queued': queued,
        'skipped': skipped,
        'skipped_reasons': skipped_reasons,
    })
