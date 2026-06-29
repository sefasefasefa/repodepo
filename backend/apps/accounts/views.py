import secrets
from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


def get_jwt_tokens(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }


def format_user(user, is_following=False, is_subscribed=False):
    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'displayName': user.display_name,
        'avatarUrl': user.avatar_url,
        'bannerUrl': user.banner_url,
        'bio': user.bio,
        'role': user.role,
        'isVerified': user.is_verified,
        'isBanned': user.is_banned,
        'followerCount': user.follower_count,
        'followingCount': user.following_count,
        'videoCount': user.video_count,
        'totalViews': user.total_views,
        'subscriptionPrice': float(user.subscription_price) if user.subscription_price else None,
        'socialLinks': user.social_links,
        'isFollowing': is_following,
        'isSubscribed': is_subscribed,
        'createdAt': user.created_at.isoformat() if user.created_at else None,
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    # Kayıt açık/kapalı kontrolü
    try:
        from apps.admin_panel.models import SiteSettings
        s, _ = SiteSettings.objects.get_or_create(id=1)
        if not s.registration_enabled:
            return Response({'error': 'Yeni kullanıcı kayıtları şu an kapalı.'}, status=403)
    except Exception:
        pass

    data = request.data
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    display_name = data.get('displayName', data.get('display_name', username))

    if not username or not email or not password:
        return Response({'error': 'username, email ve password gerekli'}, status=400)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already in use'}, status=400)
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already taken'}, status=400)

    user = User(username=username, email=email, display_name=display_name or username)
    user.set_password(password)
    user.generate_session_token()
    user.save()

    tokens = get_jwt_tokens(user)
    return Response({
        'user': format_user(user),
        'token': user.session_token,
        'access': tokens['access'],
        'refresh': tokens['refresh'],
    }, status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    data = request.data
    # Accept both `email` and `username` keys so frontend clients work either way.
    identifier = (data.get('email') or data.get('username') or '').strip().lower()
    password = data.get('password', '')

    if not identifier or not password:
        return Response({'error': 'Kullanıcı adı/e-posta ve şifre gerekli'}, status=400)

    try:
        user = User.objects.get(Q(email__iexact=identifier) | Q(username__iexact=identifier))
    except User.DoesNotExist:
        return Response({'error': 'Kullanıcı adı/e-posta veya şifre hatalı.'}, status=401)

    if not user.check_password(password):
        return Response({'error': 'Kullanıcı adı/e-posta veya şifre hatalı.'}, status=401)

    if user.is_banned:
        return Response({'error': 'Hesabınız askıya alınmıştır.'}, status=403)

    user.generate_session_token()
    user.save(update_fields=['session_token'])

    tokens = get_jwt_tokens(user)
    return Response({
        'user': format_user(user),
        'token': user.session_token,
        'access': tokens['access'],
        'refresh': tokens['refresh'],
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def logout_view(request):
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        User.objects.filter(session_token=token).update(session_token=None)
    return Response({'message': 'Logged out'})


@api_view(['GET'])
@permission_classes([AllowAny])
def me(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Not authenticated'}, status=401)
    return Response(format_user(request.user))


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    user = request.user
    data = request.data

    if 'displayName' in data or 'display_name' in data:
        user.display_name = data.get('displayName', data.get('display_name', user.display_name))
    if 'bio' in data:
        user.bio = data.get('bio')
    if 'avatarUrl' in data or 'avatar_url' in data:
        user.avatar_url = data.get('avatarUrl', data.get('avatar_url'))
    if 'bannerUrl' in data or 'banner_url' in data:
        user.banner_url = data.get('bannerUrl', data.get('banner_url'))
    if 'socialLinks' in data or 'social_links' in data:
        user.social_links = data.get('socialLinks', data.get('social_links'))
    if 'subscriptionPrice' in data or 'subscription_price' in data:
        price = data.get('subscriptionPrice', data.get('subscription_price'))
        user.subscription_price = price if price else None

    user.save()
    return Response(format_user(user))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_avatar(request):
    import os, uuid
    from django.conf import settings

    file = request.FILES.get('avatar')
    if not file:
        return Response({'error': 'Dosya gönderilmedi'}, status=400)

    allowed = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}
    if file.content_type not in allowed:
        return Response({'error': 'Sadece JPEG, PNG, WebP veya GIF desteklenir'}, status=400)

    if file.size > 5 * 1024 * 1024:
        return Response({'error': 'Dosya boyutu 5 MB\'ı geçemez'}, status=400)

    ext = os.path.splitext(file.name)[1].lower() or '.jpg'
    filename = f"avatars/{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(settings.MEDIA_ROOT, filename)

    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    with open(save_path, 'wb') as f:
        for chunk in file.chunks():
            f.write(chunk)

    avatar_url = f"{settings.MEDIA_URL}{filename}"
    request.user.avatar_url = avatar_url
    request.user.save(update_fields=['avatar_url'])

    return Response({'avatarUrl': avatar_url, 'user': format_user(request.user)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user
    current = request.data.get('currentPassword', request.data.get('current_password', ''))
    new_pwd = request.data.get('newPassword', request.data.get('new_password', ''))

    if not current or not new_pwd:
        return Response({'error': 'currentPassword ve newPassword gerekli'}, status=400)

    if not user.check_password(current):
        return Response({'error': 'Mevcut şifre hatalı'}, status=401)

    user.set_password(new_pwd)
    user.save()
    return Response({'message': 'Şifre güncellendi'})


@api_view(['GET'])
@permission_classes([AllowAny])
def list_users(request):
    from apps.social.models import Follow
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    role = request.query_params.get('role')
    offset = (page - 1) * limit

    qs = User.objects.all()
    if role:
        qs = qs.filter(role=role)

    total = qs.count()
    users = qs.order_by('-follower_count')[offset:offset + limit]

    following_ids = set()
    if request.user.is_authenticated:
        following_ids = set(
            Follow.objects.filter(follower=request.user).values_list('following_id', flat=True)
        )

    return Response({
        'users': [format_user(u, is_following=u.id in following_ids) for u in users],
        'total': total,
        'page': page,
        'limit': limit,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def get_user_by_id(request, user_id):
    from apps.social.models import Follow
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)

    is_following = False
    if request.user.is_authenticated:
        is_following = Follow.objects.filter(follower=request.user, following=user).exists()

    return Response(format_user(user, is_following=is_following))


@api_view(['GET'])
@permission_classes([AllowAny])
def get_user_profile(request, username):
    from apps.social.models import Follow
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)

    is_following = False
    if request.user.is_authenticated:
        is_following = Follow.objects.filter(follower=request.user, following=user).exists()

    return Response(format_user(user, is_following=is_following))


@api_view(['GET'])
@permission_classes([AllowAny])
def search_users(request):
    q = request.query_params.get('q', '').strip()
    limit = min(int(request.query_params.get('limit', 10)), 20)
    if not q:
        return Response({'users': []})
    users = User.objects.filter(
        Q(username__icontains=q) | Q(display_name__icontains=q)
    )[:limit]
    return Response({'users': [
        {'id': u.id, 'username': u.username, 'displayName': u.display_name,
         'avatarUrl': u.avatar_url, 'role': u.role, 'isVerified': u.is_verified}
        for u in users
    ]})
