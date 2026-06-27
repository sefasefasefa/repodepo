from django.db.models import Sum, Count, Q
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.videos.models import Video, VideoReport, Ad, CustomPage, WatermarkSettings, AutoCategoryRule
from apps.subscriptions.models import Payment, SubscriptionPlan, UserSubscription
from apps.social.models import BadgeDefinition, UserBadge, CreatorApplication
from apps.tokens.models import TokenPackage, WithdrawalRequest
from apps.core.models import GeoRestrictionSettings, ApiEndpoint, FeatureFlag, AbTest, AbTestVariant
from apps.accounts.views import format_user
from .models import SiteSettings

User = get_user_model()


def require_admin(request):
    if not request.user.is_authenticated:
        return False
    return request.user.role in ('admin', 'moderator')


def require_superadmin(request):
    if not request.user.is_authenticated:
        return False
    return request.user.role == 'admin'


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def platform_analytics(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    return Response({
        'totalUsers': User.objects.count(),
        'totalVideos': Video.objects.count(),
        'totalViews': Video.objects.aggregate(total=Sum('view_count'))['total'] or 0,
        'totalRevenue': float(Payment.objects.aggregate(total=Sum('amount'))['total'] or 0),
        'activeSubscriptions': UserSubscription.objects.filter(status='active').count(),
        'totalCreators': User.objects.filter(role='creator').count(),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_reports(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    page = int(request.query_params.get('page', 1))
    limit = 20
    offset = (page - 1) * limit
    status_filter = request.query_params.get('status')
    qs = VideoReport.objects.select_related('reporter', 'video').order_by('-created_at')
    if status_filter:
        qs = qs.filter(status=status_filter)
    total = qs.count()
    items = list(qs[offset:offset + limit])
    return Response({
        'reports': [{
            'id': r.id, 'reason': r.reason, 'description': r.description,
            'status': r.status, 'contentType': r.content_type,
            'videoId': r.video_id, 'reporterId': r.reporter_id,
            'reporter': format_user(r.reporter),
            'createdAt': r.created_at.isoformat(),
        } for r in items],
        'total': total, 'page': page,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resolve_report(request, report_id):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    VideoReport.objects.filter(id=report_id).update(
        status=request.data.get('status', 'resolved'),
        admin_note=request.data.get('adminNote', ''),
    )
    return Response({'message': 'Report updated'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_admin_users(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 100)
    offset = (page - 1) * limit
    q = request.query_params.get('q', '')
    qs = User.objects.all()
    if q:
        qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q) | Q(display_name__icontains=q))
    total = qs.count()
    users = list(qs.order_by('-created_at')[offset:offset + limit])
    return Response({
        'users': [format_user(u) for u in users],
        'total': total, 'page': page,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ban_user(request, user_id):
    if not require_superadmin(request):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)
    user.is_banned = request.data.get('isBanned', True)
    user.ban_reason = request.data.get('banReason', request.data.get('reason', ''))
    user.save(update_fields=['is_banned', 'ban_reason'])
    return Response({'message': 'User updated', 'isBanned': user.is_banned})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_user_role(request, user_id):
    if not require_superadmin(request):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)
    new_role = request.data.get('role', 'user')
    if new_role not in ('user', 'creator', 'moderator', 'admin'):
        return Response({'error': 'Invalid role'}, status=400)
    user.role = new_role
    user.save(update_fields=['role'])
    return Response({'message': 'Role updated', 'role': user.role})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def edit_user(request, user_id):
    if not require_superadmin(request):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'Kullanıcı bulunamadı'}, status=404)

    data = request.data
    update_fields = []

    username = data.get('username', '').strip()
    if username:
        if username != user.username:
            if User.objects.filter(username__iexact=username).exclude(id=user_id).exists():
                return Response({'error': 'Bu kullanıcı adı zaten kullanılıyor'}, status=400)
        user.username = username
        update_fields.append('username')

    display_name = data.get('displayName', '').strip()
    if display_name:
        user.display_name = display_name
        update_fields.append('display_name')

    email = data.get('email', '').strip()
    if email:
        if email != user.email:
            if User.objects.filter(email__iexact=email).exclude(id=user_id).exists():
                return Response({'error': 'Bu e-posta adresi zaten kullanılıyor'}, status=400)
        user.email = email
        update_fields.append('email')

    password = data.get('password', '')
    if password:
        if len(password) < 6:
            return Response({'error': 'Şifre en az 6 karakter olmalı'}, status=400)
        user.set_password(password)
        update_fields.append('password_hash')

    if update_fields:
        user.save(update_fields=update_fields)

    return Response({'message': 'Kullanıcı güncellendi', 'user': format_user(user)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_admin_videos(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 100)
    offset = (page - 1) * limit
    q = request.query_params.get('q', '')
    qs = Video.objects.select_related('creator', 'category')
    if q:
        qs = qs.filter(Q(title__icontains=q) | Q(creator__username__icontains=q))
    total = qs.count()
    videos = list(qs.order_by('-created_at')[offset:offset + limit])
    from apps.videos.views import enrich_videos_bulk
    return Response({'videos': enrich_videos_bulk(videos), 'total': total, 'page': page})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_video_admin(request, video_id):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    Video.objects.filter(id=video_id).delete()
    return Response({'message': 'Video deleted'})


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def manage_watermark(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    settings_obj, _ = WatermarkSettings.objects.get_or_create(id=1)
    if request.method == 'PUT':
        data = request.data
        settings_obj.is_enabled = data.get('isEnabled', settings_obj.is_enabled)
        settings_obj.text = data.get('text', settings_obj.text)
        settings_obj.position = data.get('position', settings_obj.position)
        settings_obj.size = data.get('size', settings_obj.size)
        settings_obj.opacity = data.get('opacity', settings_obj.opacity)
        settings_obj.use_image = data.get('useImage', settings_obj.use_image)
        settings_obj.image_url = data.get('imageUrl', settings_obj.image_url)
        settings_obj.save()
    return Response({
        'isEnabled': settings_obj.is_enabled, 'imageUrl': settings_obj.image_url,
        'text': settings_obj.text, 'useImage': settings_obj.use_image,
        'position': settings_obj.position, 'size': settings_obj.size, 'opacity': settings_obj.opacity,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_geo_settings(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    settings_obj, _ = GeoRestrictionSettings.objects.get_or_create(id=1)
    return Response({
        'isEnabled': settings_obj.is_enabled, 'mode': settings_obj.mode,
        'countries': settings_obj.countries, 'redirectUrl': settings_obj.redirect_url,
        'message': settings_obj.message,
    })


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_geo_settings(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    settings_obj, _ = GeoRestrictionSettings.objects.get_or_create(id=1)
    data = request.data
    settings_obj.is_enabled = data.get('isEnabled', settings_obj.is_enabled)
    settings_obj.mode = data.get('mode', settings_obj.mode)
    settings_obj.countries = data.get('countries', settings_obj.countries)
    settings_obj.redirect_url = data.get('redirectUrl', settings_obj.redirect_url)
    settings_obj.message = data.get('message', settings_obj.message)
    settings_obj.save()
    return Response({'message': 'Geo settings updated'})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_subscription_plans(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    if request.method == 'POST':
        data = request.data
        plan = SubscriptionPlan.objects.create(
            name=data.get('name', ''), description=data.get('description', ''),
            price=data.get('price', 0), billing_cycle=data.get('billingCycle', 'monthly'),
            features=data.get('features', []), is_popular=data.get('isPopular', False),
        )
        return Response({'id': plan.id, 'name': plan.name}, status=201)
    plans = SubscriptionPlan.objects.all()
    return Response({'plans': [{
        'id': p.id, 'name': p.name, 'description': p.description,
        'price': float(p.price), 'billingCycle': p.billing_cycle,
        'features': p.features, 'isPopular': p.is_popular, 'isActive': p.is_active,
    } for p in plans]})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def creator_analytics(request, user_id):
    if not request.user.is_authenticated:
        return Response({'error': 'Auth required'}, status=401)
    if str(request.user.id) != str(user_id) and not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    videos = Video.objects.filter(creator_id=user_id).order_by('-view_count')[:5]
    total_views = Video.objects.filter(creator_id=user_id).aggregate(total=Sum('view_count'))['total'] or 0
    total_likes = Video.objects.filter(creator_id=user_id).aggregate(total=Sum('like_count'))['total'] or 0
    from apps.videos.views import enrich_videos_bulk
    return Response({
        'totalViews': total_views,
        'totalLikes': total_likes,
        'videoCount': Video.objects.filter(creator_id=user_id).count(),
        'topVideos': enrich_videos_bulk(list(videos)),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_withdrawal_requests(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    qs = WithdrawalRequest.objects.select_related('creator').order_by('-created_at')
    return Response({'requests': [{
        'id': r.id, 'creatorId': r.creator_id,
        'creator': format_user(r.creator),
        'tokenAmount': r.token_amount, 'usdAmount': float(r.usd_amount),
        'method': r.method, 'status': r.status, 'createdAt': r.created_at.isoformat(),
    } for r in qs]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_withdrawal(request, wr_id):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    WithdrawalRequest.objects.filter(id=wr_id).update(
        status=request.data.get('status', 'approved'),
        admin_note=request.data.get('adminNote', ''),
    )
    return Response({'message': 'Updated'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_creator_applications(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    apps = CreatorApplication.objects.select_related('user').order_by('-created_at')
    return Response({'applications': [{
        'id': a.id, 'user': format_user(a.user), 'reason': a.reason,
        'status': a.status, 'adminNote': a.admin_note, 'createdAt': a.created_at.isoformat(),
    } for a in apps]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_creator_application(request, app_id):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        app = CreatorApplication.objects.get(id=app_id)
    except CreatorApplication.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)
    new_status = request.data.get('status', 'approved')
    app.status = new_status
    app.admin_note = request.data.get('adminNote', '')
    app.save()
    if new_status == 'approved':
        User.objects.filter(id=app.user_id).update(role='creator')
    return Response({'message': 'Application processed'})


@api_view(['GET'])
@permission_classes([])
def public_site_config(request):
    s, _ = SiteSettings.objects.get_or_create(id=1)
    return Response({
        'siteName': s.site_name,
        'siteDescription': s.site_description,
        'logoUrl': s.logo_url,
        'faviconUrl': s.favicon_url,
        'primaryColor': s.primary_color,
        'registrationEnabled': s.registration_enabled,
        'maintenanceMode': s.maintenance_mode,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_site_settings(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    s, _ = SiteSettings.objects.get_or_create(id=1)
    return Response({
        'siteName': s.site_name, 'siteDescription': s.site_description,
        'logoUrl': s.logo_url, 'faviconUrl': s.favicon_url,
        'primaryColor': s.primary_color, 'maintenanceMode': s.maintenance_mode,
        'registrationEnabled': s.registration_enabled,
        'creatorApplicationEnabled': s.creator_application_enabled,
        'contactEmail': s.contact_email,
    })


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_site_settings(request):
    if not require_superadmin(request):
        return Response({'error': 'Forbidden'}, status=403)
    s, _ = SiteSettings.objects.get_or_create(id=1)
    data = request.data
    s.site_name = data.get('siteName', s.site_name)
    s.site_description = data.get('siteDescription', s.site_description)
    s.logo_url = data.get('logoUrl', s.logo_url)
    s.favicon_url = data.get('faviconUrl', s.favicon_url)
    s.primary_color = data.get('primaryColor', s.primary_color)
    s.maintenance_mode = data.get('maintenanceMode', s.maintenance_mode)
    s.registration_enabled = data.get('registrationEnabled', s.registration_enabled)
    s.creator_application_enabled = data.get('creatorApplicationEnabled', s.creator_application_enabled)
    s.contact_email = data.get('contactEmail', s.contact_email)
    s.save()
    return Response({'message': 'Settings updated'})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_ads(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    if request.method == 'POST':
        data = request.data
        ad = Ad.objects.create(
            name=data.get('name', ''), type=data.get('type', 'banner'),
            category=data.get('category', 'general'), position=data.get('position', 'home_top'),
            image_url=data.get('imageUrl'), video_url=data.get('videoUrl'),
            target_url=data.get('targetUrl', '#'), script_code=data.get('scriptCode'),
            created_by=request.user,
        )
        return Response({'id': ad.id}, status=201)
    ads = Ad.objects.all().order_by('-created_at')
    return Response({'ads': [{
        'id': a.id, 'name': a.name, 'type': a.type, 'position': a.position,
        'isActive': a.is_active, 'impressions': a.impressions, 'clicks': a.clicks,
    } for a in ads]})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_ad(request, ad_id):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    Ad.objects.filter(id=ad_id).delete()
    return Response({'message': 'Ad deleted'})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_badges(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    if request.method == 'POST':
        data = request.data
        badge = BadgeDefinition.objects.create(
            slug=data.get('slug', ''), name=data.get('name', ''),
            description=data.get('description', ''), icon=data.get('icon', '🏅'),
            color=data.get('color', '#a855f7'), criteria=data.get('criteria', 'manual'),
            threshold=data.get('threshold', 1),
        )
        return Response({'id': badge.id}, status=201)
    badges = BadgeDefinition.objects.all().order_by('sort_order')
    return Response({'badges': [{
        'id': b.id, 'slug': b.slug, 'name': b.name, 'icon': b.icon,
        'color': b.color, 'isEnabled': b.is_enabled,
    } for b in badges]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def award_badge(request, user_id):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    badge_id = request.data.get('badgeId', request.data.get('badge_id'))
    try:
        user = User.objects.get(id=user_id)
        badge = BadgeDefinition.objects.get(id=badge_id)
    except (User.DoesNotExist, BadgeDefinition.DoesNotExist):
        return Response({'error': 'Not found'}, status=404)
    UserBadge.objects.get_or_create(user=user, badge=badge, defaults={'awarded_by_admin': True, 'note': request.data.get('note', '')})
    return Response({'message': 'Badge awarded'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_custom_pages(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    pages = CustomPage.objects.all()
    return Response({'pages': [{'id': p.id, 'slug': p.slug, 'title': p.title, 'isPublished': p.is_published} for p in pages]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_custom_page(request):
    if not require_admin(request):
        return Response({'error': 'Forbidden'}, status=403)
    data = request.data
    page = CustomPage.objects.create(
        slug=data.get('slug', ''), title=data.get('title', ''),
        content=data.get('content', ''), is_published=data.get('isPublished', False),
        created_by=request.user,
    )
    return Response({'id': page.id, 'slug': page.slug}, status=201)
