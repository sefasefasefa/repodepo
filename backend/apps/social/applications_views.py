"""Creator applications (admin) + creator upload limits."""
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import CreatorApplication, CreatorUploadLimit
from apps.accounts.views import format_user
from apps.videos.models import Video

User = get_user_model()

DEFAULT_LIMITS = {
    'maxFileSizeMb': 2048,
    'maxDurationSec': 3600,
    'maxDailyUploads': 5,
    'maxResolution': '4K',
    'allowedTypes': ['video', 'short'],
    'premiumAllowed': True,
    'ppvAllowed': True,
    'notes': None,
}


def _admin(u):
    return u.is_authenticated and u.role == 'admin'


def _fmt_application(app, include_user=False):
    out = {
        'id': app.id, 'userId': app.user_id,
        'status': app.status,
        'motivation': app.reason,
        'reason': app.reason,
        'socialLinks': app.social_media,
        'portfolioUrl': app.portfolio_url,
        'reviewNote': app.admin_note,
        'createdAt': app.created_at.isoformat() if app.created_at else None,
        'updatedAt': app.updated_at.isoformat() if app.updated_at else None,
    }
    if include_user:
        out['applicant'] = format_user(app.user)
    return out


def _fmt_limits(lim):
    if not lim:
        return DEFAULT_LIMITS
    return {
        'maxFileSizeMb': lim.max_file_size_mb,
        'maxDurationSec': lim.max_duration_sec,
        'maxDailyUploads': lim.max_daily_uploads,
        'maxResolution': lim.max_resolution,
        'allowedTypes': lim.allowed_types or ['video', 'short'],
        'premiumAllowed': lim.premium_allowed,
        'ppvAllowed': lim.ppv_allowed,
        'notes': lim.notes,
    }


# ── Admin: list / decide applications ────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_list_applications(request):
    if not _admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    status_filter = request.query_params.get('status')
    page = max(1, int(request.query_params.get('page', 1)))
    limit = 20
    qs = CreatorApplication.objects.select_related('user').order_by('-created_at')
    if status_filter:
        qs = qs.filter(status=status_filter)
    total = qs.count()
    rows = qs[(page - 1) * limit: page * limit]
    return Response({
        'applications': [_fmt_application(a, include_user=True) for a in rows],
        'total': total, 'page': page,
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def admin_decide_application(request, app_id):
    if not _admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    app = CreatorApplication.objects.filter(id=app_id).first()
    if not app:
        return Response({'error': 'Başvuru bulunamadı'}, status=404)

    action = request.data.get('action')
    if action not in ('approve', 'deny'):
        return Response({'error': "action 'approve' veya 'deny' olmalı"}, status=400)

    new_status = 'approved' if action == 'approve' else 'rejected'
    app.status = new_status
    app.admin_note = request.data.get('reviewNote') or app.admin_note
    app.save(update_fields=['status', 'admin_note', 'updated_at'])

    if action == 'approve':
        User.objects.filter(id=app.user_id).update(role='creator')
        CreatorUploadLimit.objects.get_or_create(creator_id=app.user_id)

    return Response({'ok': True, 'status': new_status})


# ── Admin: creator upload limits ────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_get_limits(request, user_id):
    if not _admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    lim = CreatorUploadLimit.objects.filter(creator_id=user_id).first()
    return Response({'limits': _fmt_limits(lim) if lim else None})


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def admin_set_limits(request, user_id):
    if not _admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    if not User.objects.filter(id=user_id).exists():
        return Response({'error': 'Kullanıcı bulunamadı'}, status=404)
    d = request.data
    defaults = {}
    if 'maxFileSizeMb' in d:    defaults['max_file_size_mb'] = int(d['maxFileSizeMb'])
    if 'maxDurationSec' in d:   defaults['max_duration_sec'] = int(d['maxDurationSec'])
    if 'maxDailyUploads' in d:  defaults['max_daily_uploads'] = int(d['maxDailyUploads'])
    if 'maxResolution' in d:    defaults['max_resolution'] = d['maxResolution']
    if 'allowedTypes' in d:     defaults['allowed_types'] = list(d['allowedTypes'])
    if 'premiumAllowed' in d:   defaults['premium_allowed'] = bool(d['premiumAllowed'])
    if 'ppvAllowed' in d:       defaults['ppv_allowed'] = bool(d['ppvAllowed'])
    if 'notes' in d:            defaults['notes'] = d['notes']
    lim, _ = CreatorUploadLimit.objects.update_or_create(creator_id=user_id, defaults=defaults)
    return Response({'limits': _fmt_limits(lim)})


# ── Creator self: limits + uploaded today ───────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_limits(request):
    lim = CreatorUploadLimit.objects.filter(creator_id=request.user.id).first()
    today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    uploaded_today = Video.objects.filter(creator=request.user, created_at__gte=today).count()
    return Response({'limits': _fmt_limits(lim), 'uploadedToday': uploaded_today})
