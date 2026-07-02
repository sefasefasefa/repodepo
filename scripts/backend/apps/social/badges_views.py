from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from .models import BadgeDefinition, UserBadge, BadgeSystemSettings

User = get_user_model()


def _is_admin(user):
    return user.is_authenticated and getattr(user, 'role', '') == 'admin'


def _get_settings():
    s = BadgeSystemSettings.objects.first()
    if not s:
        s = BadgeSystemSettings.objects.create()
    return s


def _ensure_defaults():
    defaults = [
        ('creator', 'Creator', 'İçerik üreticisi', '🎬', '#8b5cf6', 'creator_role', 1, 1),
        ('verified', 'Verified', 'Doğrulanmış hesap', '✓', '#3b82f6', 'verified', 1, 2),
        ('rising', '1K Followers', '1.000 takipçi', '⭐', '#f59e0b', 'follower_count', 1000, 3),
        ('star', '10K Followers', '10K takipçi', '🌟', '#ef4444', 'follower_count', 10000, 4),
        ('prolific', '10 Videos', '10 video yükledi', '📹', '#10b981', 'video_count', 10, 5),
    ]
    for slug, name, desc, icon, color, criteria, threshold, order in defaults:
        BadgeDefinition.objects.get_or_create(
            slug=slug, defaults={
                'name': name, 'description': desc, 'icon': icon, 'color': color,
                'criteria': criteria, 'threshold': threshold, 'sort_order': order,
            },
        )


def _fmt_def(d):
    return {
        'id': d.id, 'slug': d.slug, 'name': d.name, 'description': d.description,
        'icon': d.icon, 'color': d.color, 'criteria': d.criteria, 'threshold': d.threshold,
        'isEnabled': d.is_enabled, 'sortOrder': d.sort_order,
    }


def _fmt_user_badge(ub):
    return {
        'id': ub.id, 'userId': ub.user_id, 'badgeId': ub.badge_id,
        'earnedAt': ub.earned_at.isoformat() if ub.earned_at else None,
        'isDisplayed': ub.is_displayed, 'awardedByAdmin': ub.awarded_by_admin,
        'note': ub.note,
        'badge': _fmt_def(ub.badge),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_badges(request):
    badges = UserBadge.objects.filter(user=request.user).select_related('badge').order_by('-earned_at')
    return Response({'userBadges': [_fmt_user_badge(b) for b in badges]})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_my_badge(request, ub_id):
    try:
        ub = UserBadge.objects.get(id=ub_id, user=request.user)
    except UserBadge.DoesNotExist:
        return Response({'error': 'Rozet bulunamadı'}, status=404)
    is_displayed = (request.data or {}).get('isDisplayed')
    if is_displayed is not None:
        ub.is_displayed = bool(is_displayed)
        ub.save(update_fields=['is_displayed'])
    return Response({'userBadge': _fmt_user_badge(ub)})


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def admin_settings(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    s = _get_settings()
    if request.method == 'PUT':
        data = request.data or {}
        if 'isActive' in data:
            s.is_active = bool(data['isActive'])
        if 'autoAwardEnabled' in data:
            s.auto_award_enabled = bool(data['autoAwardEnabled'])
        s.save()
        if s.is_active:
            _ensure_defaults()
    return Response({'settings': {
        'id': s.id, 'isActive': s.is_active, 'autoAwardEnabled': s.auto_award_enabled,
    }})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_definitions(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    if request.method == 'POST':
        d = request.data or {}
        if not d.get('slug') or not d.get('name'):
            return Response({'error': 'Slug ve isim gerekli'}, status=400)
        bd = BadgeDefinition.objects.create(
            slug=d['slug'], name=d['name'],
            description=d.get('description', ''), icon=d.get('icon', '🏅'),
            color=d.get('color', '#a855f7'), criteria=d.get('criteria', 'manual'),
            threshold=d.get('threshold', 1), sort_order=d.get('sortOrder', 0),
        )
        return Response({'definition': _fmt_def(bd)})
    _ensure_defaults()
    defs = BadgeDefinition.objects.all().order_by('sort_order')
    return Response({'definitions': [_fmt_def(d) for d in defs]})


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def admin_definition_detail(request, def_id):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    try:
        d = BadgeDefinition.objects.get(id=def_id)
    except BadgeDefinition.DoesNotExist:
        return Response({'error': 'Bulunamadı'}, status=404)
    if request.method == 'DELETE':
        UserBadge.objects.filter(badge=d).delete()
        d.delete()
        return Response({'ok': True})
    data = request.data or {}
    for src, dst in [('name', 'name'), ('description', 'description'), ('icon', 'icon'),
                     ('color', 'color'), ('isEnabled', 'is_enabled'),
                     ('threshold', 'threshold'), ('sortOrder', 'sort_order')]:
        if src in data:
            setattr(d, dst, data[src])
    d.save()
    return Response({'definition': _fmt_def(d)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_award(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    d = request.data or {}
    uid, bid = d.get('userId'), d.get('badgeId')
    if not uid or not bid:
        return Response({'error': 'userId ve badgeId gerekli'}, status=400)
    if UserBadge.objects.filter(user_id=uid, badge_id=bid).exists():
        return Response({'error': 'Kullanıcı bu rozete zaten sahip'}, status=409)
    ub = UserBadge.objects.create(
        user_id=uid, badge_id=bid, awarded_by_admin=True, note=d.get('note'),
    )
    return Response({'userBadge': _fmt_user_badge(ub)})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_revoke(request, ub_id):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    UserBadge.objects.filter(id=ub_id).delete()
    return Response({'ok': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_user_badges(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    badges = UserBadge.objects.select_related('user', 'badge').order_by('-earned_at')[:100]
    out = []
    for b in badges:
        out.append({
            'id': b.id, 'earnedAt': b.earned_at.isoformat() if b.earned_at else None,
            'awardedByAdmin': b.awarded_by_admin, 'note': b.note,
            'user': {
                'id': b.user.id, 'username': b.user.username,
                'displayName': b.user.display_name, 'avatarUrl': b.user.avatar_url,
            },
            'badge': {
                'id': b.badge.id, 'name': b.badge.name,
                'icon': b.badge.icon, 'color': b.badge.color,
            },
        })
    return Response({'userBadges': out})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_auto_award(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    s = _get_settings()
    if not s.is_active:
        return Response({'error': 'Rozet sistemi aktif değil'}, status=503)
    defs = list(BadgeDefinition.objects.filter(is_enabled=True))
    users = User.objects.all()[:1000]
    awarded = 0
    for u in users:
        for d in defs:
            if d.criteria == 'manual':
                continue
            qualifies = False
            if d.criteria == 'creator_role':
                qualifies = getattr(u, 'role', '') in ('creator', 'admin')
            elif d.criteria == 'verified':
                qualifies = getattr(u, 'is_verified', False)
            elif d.criteria == 'follower_count':
                qualifies = getattr(u, 'follower_count', 0) >= d.threshold
            elif d.criteria == 'video_count':
                qualifies = getattr(u, 'video_count', 0) >= d.threshold
            if not qualifies:
                continue
            if UserBadge.objects.filter(user=u, badge=d).exists():
                continue
            UserBadge.objects.create(user=u, badge=d)
            awarded += 1
    return Response({'ok': True, 'awarded': awarded})
