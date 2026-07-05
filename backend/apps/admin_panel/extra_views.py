from django.contrib.auth import get_user_model
from django.db.models import Count, Sum, Q
from django.utils import timezone
from datetime import timedelta
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from apps.videos.models import Video, VideoReport, CustomPage
from apps.subscriptions.models import Payment
from .models import HomeFilter

User = get_user_model()


def _is_admin(u):
    return u.is_authenticated and getattr(u, 'role', '') in ('admin', 'moderator')


def _is_super_admin(u):
    return u.is_authenticated and getattr(u, 'role', '') == 'admin'


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unban_user(request, user_id):
    if not _is_super_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    User.objects.filter(id=user_id).update(is_banned=False, ban_reason=None)
    return Response({'message': 'User unbanned'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    total_users = User.objects.count()
    total_videos = Video.objects.count()
    pending = VideoReport.objects.filter(status='pending').count()
    revenue = float(Payment.objects.aggregate(s=Sum('amount'))['s'] or 0)
    week_ago = timezone.now() - timedelta(days=7)
    new_users_week = User.objects.filter(created_at__gte=week_ago).count()
    new_videos_week = Video.objects.filter(created_at__gte=week_ago).count()
    recent = VideoReport.objects.select_related('reporter').order_by('-created_at')[:5]
    top_creators = User.objects.filter(role='creator').order_by('-follower_count')[:5]
    return Response({
        'totalUsers': total_users,
        'totalVideos': total_videos,
        'pendingReports': pending,
        'totalRevenue': revenue,
        'newUsersThisWeek': new_users_week,
        'newVideosThisWeek': new_videos_week,
        'recentReports': [{
            'id': r.id, 'reason': r.reason, 'description': r.description,
            'status': r.status, 'videoId': r.video_id, 'video': None,
            'reporterId': r.reporter_id,
            'reporter': {
                'id': r.reporter.id, 'username': r.reporter.username,
                'displayName': r.reporter.display_name, 'avatarUrl': r.reporter.avatar_url,
            },
            'createdAt': r.created_at.isoformat(),
        } for r in recent],
        'topCreators': [{
            'id': u.id, 'username': u.username, 'displayName': u.display_name,
            'avatarUrl': u.avatar_url, 'isVerified': u.is_verified,
            'followerCount': u.follower_count, 'isFollowing': False,
        } for u in top_creators],
    })


# ─── Reports PATCH ──────────────────────────────────────────────────────
@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_report(request, report_id):
    if not _is_admin(request.user):
        return Response({'error': 'Yetkisiz'}, status=403)
    d = request.data or {}
    status = d.get('status')
    if status not in ('pending', 'resolved', 'dismissed'):
        return Response({'error': 'Geçersiz durum'}, status=400)
    try:
        r = VideoReport.objects.get(id=report_id)
    except VideoReport.DoesNotExist:
        return Response({'error': 'Rapor bulunamadı'}, status=404)
    r.status = status
    if 'adminNote' in d:
        r.admin_note = d['adminNote']
    r.save()
    return Response({'report': {'id': r.id, 'status': r.status, 'adminNote': r.admin_note}})


# ─── Custom Pages public list + admin CRUD ─────────────────────────────
def _fmt_page(p, full=False):
    base = {
        'id': p.id, 'slug': p.slug, 'title': p.title,
        'isPublished': p.is_published,
        'createdAt': p.created_at.isoformat(),
        'updatedAt': p.updated_at.isoformat() if p.updated_at else None,
    }
    if full:
        base['content'] = p.content
    return base


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def pages(request):
    if request.method == 'POST':
        if not _is_super_admin(request.user):
            return Response({'error': 'Yetkisiz'}, status=403)
        d = request.data or {}
        slug, title = d.get('slug'), d.get('title')
        if not slug or not title:
            return Response({'error': 'slug ve title zorunlu'}, status=400)
        import re
        if not re.match(r'^[a-z0-9-]+$', slug):
            return Response({'error': 'Slug yalnızca küçük harf, rakam ve tire içerebilir'}, status=400)
        if CustomPage.objects.filter(slug=slug).exists():
            return Response({'error': 'Bu slug zaten kullanımda'}, status=409)
        # Express stores `blocks` JSON; we serialize into content text field.
        import json
        content = d.get('content')
        if content is None and 'blocks' in d:
            content = json.dumps(d['blocks'])
        p = CustomPage.objects.create(
            slug=slug, title=title, content=content or '',
            is_published=bool(d.get('isPublished', False)),
            created_by=request.user,
        )
        return Response(_fmt_page(p, full=True), status=201)
    is_admin = _is_admin(request.user)
    qs = CustomPage.objects.all().order_by('created_at')
    if not is_admin:
        qs = qs.filter(is_published=True)
    return Response({'pages': [_fmt_page(p) for p in qs]})


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def page_detail(request, page_id):
    if not _is_super_admin(request.user):
        return Response({'error': 'Yetkisiz'}, status=403)
    try:
        p = CustomPage.objects.get(id=page_id)
    except CustomPage.DoesNotExist:
        return Response({'error': 'Sayfa bulunamadı'}, status=404)
    if request.method == 'DELETE':
        p.delete()
        return Response({'ok': True})
    d = request.data or {}
    import re, json
    if 'slug' in d:
        if not re.match(r'^[a-z0-9-]+$', d['slug']):
            return Response({'error': 'Slug yalnızca küçük harf, rakam ve tire içerebilir'}, status=400)
        p.slug = d['slug']
    if 'title' in d:
        p.title = d['title']
    if 'content' in d:
        p.content = d['content']
    elif 'blocks' in d:
        p.content = json.dumps(d['blocks'])
    if 'isPublished' in d:
        p.is_published = bool(d['isPublished'])
    p.save()
    return Response(_fmt_page(p, full=True))


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def email_campaigns(request):
    from .models import EmailCampaign
    if request.user.role != 'admin':
        return Response({'error': 'Forbidden'}, status=403)
    if request.method == 'GET':
        qs = EmailCampaign.objects.all()
        return Response({
            'campaigns': [{
                'id': c.id,
                'name': c.name,
                'template': c.template_id,
                'audience': c.audience,
                'status': c.status,
                'sentAt': c.sent_at.strftime('%Y-%m-%d') if c.sent_at else (c.scheduled_at.strftime('%Y-%m-%d') if c.scheduled_at else None),
                'opens': c.opens,
                'clicks': c.clicks,
                'subject': c.subject,
            } for c in qs]
        })
    else:
        data = request.data
        from django.utils.dateparse import parse_datetime
        scheduled_at = None
        if data.get('scheduledAt'):
            try:
                scheduled_at = parse_datetime(data['scheduledAt'].replace('T', ' ').split('.')[0])
            except Exception:
                pass
        c = EmailCampaign.objects.create(
            name=data.get('name', ''),
            template_id=data.get('template', 'custom'),
            subject=data.get('subject', ''),
            body=data.get('body', ''),
            audience=data.get('audience', 'all'),
            status='scheduled' if scheduled_at else 'draft',
            scheduled_at=scheduled_at,
        )
        return Response({'id': c.id, 'status': c.status}, status=201)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def email_campaign_detail(request, campaign_id):
    from .models import EmailCampaign
    if request.user.role != 'admin':
        return Response({'error': 'Forbidden'}, status=403)
    try:
        c = EmailCampaign.objects.get(id=campaign_id)
        c.delete()
        return Response({'message': 'Silindi'})
    except EmailCampaign.DoesNotExist:
        return Response({'error': 'Bulunamadı'}, status=404)


def _filter_to_dict(f):
    return {
        'id': f.id, 'label': f.label, 'icon': f.icon,
        'type': f.type, 'categoryId': f.category_id,
        'sortBy': f.sort_by, 'rules': f.rules or {},
        'order': f.order, 'isActive': f.is_active,
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def public_home_filters(request):
    filters = HomeFilter.objects.filter(is_active=True)
    return Response({'filters': [_filter_to_dict(f) for f in filters]})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_home_filters(request):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    if request.method == 'GET':
        filters = HomeFilter.objects.all()
        return Response({'filters': [_filter_to_dict(f) for f in filters]})
    data = request.data
    f = HomeFilter.objects.create(
        label=data.get('label', 'Filtre'),
        icon=data.get('icon', '🎬'),
        type=data.get('type', 'sort'),
        category_id=data.get('categoryId') or None,
        sort_by=data.get('sortBy') or None,
        rules=data.get('rules') or {},
        order=data.get('order', 0),
        is_active=data.get('isActive', True),
    )
    return Response(_filter_to_dict(f), status=201)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def admin_home_filter_detail(request, filter_id):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        f = HomeFilter.objects.get(id=filter_id)
    except HomeFilter.DoesNotExist:
        return Response({'error': 'Bulunamadı'}, status=404)
    if request.method == 'DELETE':
        f.delete()
        return Response({'message': 'Silindi'})
    data = request.data
    f.label = data.get('label', f.label)
    f.icon = data.get('icon', f.icon)
    f.type = data.get('type', f.type)
    f.category_id = data.get('categoryId') or None
    f.sort_by = data.get('sortBy') or None
    f.rules = data.get('rules', f.rules) or {}
    f.order = data.get('order', f.order)
    f.is_active = data.get('isActive', f.is_active)
    f.save()
    return Response(_filter_to_dict(f))
