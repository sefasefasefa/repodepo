from django.contrib.auth import get_user_model
from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from apps.videos.models import Video
from .views import format_user

User = get_user_model()


@api_view(['GET'])
@permission_classes([AllowAny])
def user_videos(request, user_id):
    try:
        creator = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)
    page = max(1, int(request.GET.get('page', 1)))
    limit = min(50, int(request.GET.get('limit', 20)))
    offset = (page - 1) * limit
    qs = Video.objects.filter(creator=creator, is_published=True).select_related('category').order_by('-created_at')
    total = qs.count()
    videos = qs[offset:offset + limit]
    fu = format_user(creator)
    out = []
    for v in videos:
        out.append({
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
            'category': {
                'id': v.category.id, 'name': v.category.name, 'slug': v.category.slug,
            } if v.category_id else None,
            'creator': fu, 'isLiked': False, 'isBookmarked': False,
            'createdAt': v.created_at.isoformat(),
        })
    return Response({'videos': out, 'total': total, 'page': page, 'limit': limit, 'nextCursor': None})


@api_view(['GET'])
@permission_classes([AllowAny])
def user_stats(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)
    agg = Video.objects.filter(creator=user).aggregate(
        total_likes=Sum('like_count'),
    )
    return Response({
        'totalViews': getattr(user, 'total_views', 0),
        'totalLikes': int(agg['total_likes'] or 0),
        'totalFollowers': getattr(user, 'follower_count', 0),
        'totalSubscribers': 0,
        'totalRevenue': 0,
        'videoCount': getattr(user, 'video_count', 0),
    })
