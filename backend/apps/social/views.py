from django.utils import timezone
from django.db.models import F, Q
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .models import Follow, Story, StoryView, StoryLike, StoryComment, BadgeDefinition, UserBadge, CreatorApplication, CustomRequest
from apps.accounts.views import format_user

User = get_user_model()


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def follow_user(request, user_id):
    try:
        target = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)
    if target == request.user:
        return Response({'error': 'Cannot follow yourself'}, status=400)
    _, created = Follow.objects.get_or_create(follower=request.user, following=target)
    if created:
        User.objects.filter(id=request.user.id).update(following_count=F('following_count') + 1)
        User.objects.filter(id=target.id).update(follower_count=F('follower_count') + 1)
        from apps.notifications.models import Notification
        Notification.objects.create(
            user=target,
            type='follow',
            title='Yeni takipçi',
            message=f'{request.user.display_name} seni takip etmeye başladı.',
            actor=request.user,
            action_url=f'/profile/{request.user.username}',
        )
    # Invalidate video detail cache entries for this user so isFollowing reflects correctly
    from apps.videos.models import Video
    for vid_pk in Video.objects.filter(creator=target).values_list('pk', flat=True)[:50]:
        cache.delete(f'video_detail:{vid_pk}:{request.user.id}')
    return Response({'isFollowing': True})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def unfollow_user(request, user_id):
    deleted, _ = Follow.objects.filter(follower=request.user, following_id=user_id).delete()
    if deleted:
        User.objects.filter(id=request.user.id).update(following_count=F('following_count') - 1)
        User.objects.filter(id=user_id).update(follower_count=F('follower_count') - 1)
        from apps.videos.models import Video
        for vid_pk in Video.objects.filter(creator_id=user_id).values_list('pk', flat=True)[:50]:
            cache.delete(f'video_detail:{vid_pk}:{request.user.id}')
    return Response({'isFollowing': False})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_followers(request, user_id):
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    follows = Follow.objects.filter(following_id=user_id).select_related('follower')[offset:offset+limit]
    return Response({'users': [format_user(f.follower) for f in follows]})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_following(request, user_id):
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    follows = Follow.objects.filter(follower_id=user_id).select_related('following')[offset:offset+limit]
    return Response({'users': [format_user(f.following) for f in follows]})


@api_view(['GET'])
@permission_classes([AllowAny])
def list_stories(request):
    now = timezone.now()
    stories = Story.objects.filter(expires_at__gt=now).select_related('creator').order_by('-created_at')[:50]

    grouped = {}
    for story in stories:
        creator = story.creator
        if creator.id not in grouped:
            grouped[creator.id] = {'creator': format_user(creator), 'stories': []}
        grouped[creator.id]['stories'].append(_fmt_story(story))

    return Response({'storyGroups': list(grouped.values())})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_creator_stories(request, creator_id):
    now = timezone.now()
    stories = Story.objects.filter(creator_id=creator_id, expires_at__gt=now).order_by('-created_at')
    return Response({'stories': [_fmt_story(s) for s in stories]})


def _fmt_story(s):
    return {
        'id': s.id,
        'creatorId': s.creator_id,
        'mediaUrl': s.media_url,
        'mediaType': s.media_type,
        'thumbnailUrl': s.thumbnail_url,
        'caption': s.caption,
        'isPremium': s.is_premium,
        'viewCount': s.view_count,
        'duration': s.duration,
        'expiresAt': s.expires_at.isoformat(),
        'createdAt': s.created_at.isoformat(),
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_story(request):
    user = request.user
    if user.role not in ('creator', 'admin'):
        return Response({'error': 'Creator hesabı gerekli'}, status=403)
    data = request.data
    duration_hours = int(data.get('durationHours', 24))
    expires_at = timezone.now() + timezone.timedelta(hours=duration_hours)
    story = Story.objects.create(
        creator=user,
        media_url=data.get('mediaUrl', data.get('media_url', '')),
        media_type=data.get('mediaType', data.get('media_type', 'image')),
        thumbnail_url=data.get('thumbnailUrl', data.get('thumbnail_url')),
        caption=data.get('caption'),
        is_premium=data.get('isPremium', False),
        duration=data.get('duration', 5),
        expires_at=expires_at,
    )
    return Response(_fmt_story(story), status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def view_story(request, story_id):
    try:
        story = Story.objects.get(id=story_id)
    except Story.DoesNotExist:
        return Response({'error': 'Story not found'}, status=404)
    if request.user.is_authenticated:
        StoryView.objects.get_or_create(story=story, viewer=request.user)
    Story.objects.filter(id=story_id).update(view_count=F('view_count') + 1)
    return Response({'message': 'Viewed'})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_story(request, story_id):
    try:
        story = Story.objects.get(id=story_id, creator=request.user)
    except Story.DoesNotExist:
        return Response({'error': 'Story not found'}, status=404)
    story.delete()
    return Response({'message': 'Story deleted'})


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def story_like(request, story_id):
    try:
        story = Story.objects.get(id=story_id)
    except Story.DoesNotExist:
        return Response({'error': 'Story not found'}, status=404)
    if request.method == 'POST':
        emoji = request.data.get('emoji', '❤️')
        like, created = StoryLike.objects.get_or_create(story=story, user=request.user, defaults={'emoji': emoji})
        if not created:
            like.emoji = emoji
            like.save(update_fields=['emoji'])
        like_count = StoryLike.objects.filter(story=story).count()
        return Response({'liked': True, 'likeCount': like_count})
    else:
        StoryLike.objects.filter(story=story, user=request.user).delete()
        like_count = StoryLike.objects.filter(story=story).count()
        return Response({'liked': False, 'likeCount': like_count})


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def story_comments(request, story_id):
    try:
        story = Story.objects.get(id=story_id)
    except Story.DoesNotExist:
        return Response({'error': 'Story not found'}, status=404)
    if request.method == 'GET':
        comments = StoryComment.objects.filter(story=story).select_related('user')
        return Response({'comments': [{
            'id': c.id,
            'user': c.user.username,
            'avatar': c.user.avatar_url,
            'text': c.text,
            'ts': int(c.created_at.timestamp() * 1000),
        } for c in comments]})
    if not request.user.is_authenticated:
        return Response({'error': 'Authentication required'}, status=401)
    text = request.data.get('text', '').strip()
    if not text:
        return Response({'error': 'Comment text required'}, status=400)
    comment = StoryComment.objects.create(story=story, user=request.user, text=text)
    return Response({
        'id': comment.id,
        'user': comment.user.username,
        'avatar': comment.user.avatar_url,
        'text': comment.text,
        'ts': int(comment.created_at.timestamp() * 1000),
    }, status=201)


@api_view(['GET'])
@permission_classes([AllowAny])
def list_badges(request):
    badges = BadgeDefinition.objects.filter(is_enabled=True).order_by('sort_order')
    return Response({'badges': [{
        'id': b.id, 'slug': b.slug, 'name': b.name, 'description': b.description,
        'icon': b.icon, 'color': b.color, 'criteria': b.criteria, 'threshold': b.threshold,
    } for b in badges]})


@api_view(['GET'])
@permission_classes([AllowAny])
def get_user_badges(request, user_id):
    user_badges = UserBadge.objects.filter(user_id=user_id, is_displayed=True).select_related('badge')
    return Response({'badges': [{
        'id': ub.id, 'badge': {
            'id': ub.badge.id, 'slug': ub.badge.slug, 'name': ub.badge.name,
            'icon': ub.badge.icon, 'color': ub.badge.color,
        },
        'earnedAt': ub.earned_at.isoformat(),
    } for ub in user_badges]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_creator_application(request):
    if CreatorApplication.objects.filter(user=request.user, status='pending').exists():
        return Response({'error': 'Bekleyen başvurunuz var'}, status=400)
    app = CreatorApplication.objects.create(
        user=request.user,
        reason=request.data.get('reason', ''),
        portfolio_url=request.data.get('portfolioUrl', request.data.get('portfolio_url')),
        social_media=request.data.get('socialMedia', request.data.get('social_media')),
    )
    return Response({
        'id': app.id, 'status': app.status, 'reason': app.reason,
        'createdAt': app.created_at.isoformat(),
    }, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_creator_application(request):
    app = CreatorApplication.objects.filter(user=request.user).order_by('-created_at').first()
    if not app:
        return Response({'application': None})
    return Response({'application': {
        'id': app.id, 'status': app.status, 'reason': app.reason, 'adminNote': app.admin_note,
        'createdAt': app.created_at.isoformat(),
    }})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_custom_requests(request):
    role = request.query_params.get('role', 'sender')
    if role == 'creator':
        qs = CustomRequest.objects.filter(to_creator=request.user).order_by('-created_at')
    else:
        qs = CustomRequest.objects.filter(from_user=request.user).order_by('-created_at')
    return Response({'requests': [{
        'id': r.id, 'title': r.title, 'description': r.description,
        'tokenOffer': r.token_offer, 'status': r.status, 'responseNote': r.response_note,
        'fromUserId': r.from_user_id, 'toCreatorId': r.to_creator_id,
        'createdAt': r.created_at.isoformat(),
    } for r in qs]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_custom_request(request):
    data = request.data
    req = CustomRequest.objects.create(
        from_user=request.user,
        to_creator_id=data.get('toCreatorId', data.get('to_creator_id')),
        title=data.get('title', ''),
        description=data.get('description', ''),
        token_offer=int(data.get('tokenOffer', data.get('token_offer', 0))),
    )
    return Response({'id': req.id, 'status': req.status}, status=201)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def respond_custom_request(request, request_id):
    try:
        req = CustomRequest.objects.get(id=request_id, to_creator=request.user)
    except CustomRequest.DoesNotExist:
        return Response({'error': 'Request not found'}, status=404)
    new_status = request.data.get('status', req.status)
    req.status = new_status
    req.response_note = request.data.get('responseNote', request.data.get('response_note', req.response_note))
    req.save()
    return Response({'id': req.id, 'status': req.status})


@api_view(['GET'])
@permission_classes([AllowAny])
def leaderboard(request):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    period = request.query_params.get('period', 'weekly')
    tab = request.query_params.get('tab', 'general')

    qs = User.objects.filter(is_active=True, role__in=['user', 'creator', 'moderator', 'admin'])

    if tab == 'streak':
        qs = qs.order_by('-follower_count')
    else:
        qs = qs.order_by('-total_views', '-follower_count')

    users = list(qs[:50])
    result = []
    for i, u in enumerate(users):
        points = u.total_views // 10 + u.follower_count * 5
        streak = (u.follower_count % 15) if u.follower_count else 0
        level_thresholds = [(10000, 'Efsane'), (5000, 'Platinum'), (2000, 'Gold'), (500, 'Silver')]
        level = 'Bronze'
        for threshold, name in level_thresholds:
            if points >= threshold:
                level = name
                break
        result.append({
            'rank': i + 1,
            'username': u.username,
            'displayName': u.display_name or u.username,
            'points': points,
            'streak': streak,
            'level': level,
            'badges': [],
            'avatarUrl': u.avatar_url if hasattr(u, 'avatar_url') else None,
        })
    return Response({'users': result, 'period': period, 'tab': tab})
