from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import AffiliateLink, AffiliateCommission, AffiliatePayout, AffiliateSettings


def _is_admin(u):
    return u.is_authenticated and getattr(u, 'role', '') == 'admin'


def _get_settings():
    s = AffiliateSettings.objects.first()
    if not s:
        s = AffiliateSettings.objects.create()
    return s


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def stats(request):
    me = request.user
    link = AffiliateLink.objects.filter(user=me).first()
    commissions = AffiliateCommission.objects.filter(affiliate_user=me).order_by('-created_at')
    total_earned = float(commissions.aggregate(s=Sum('amount_usd'))['s'] or 0)
    pending = float(commissions.filter(status='pending').aggregate(s=Sum('amount_usd'))['s'] or 0)
    paid = float(commissions.filter(status='paid').aggregate(s=Sum('amount_usd'))['s'] or 0)
    payouts = AffiliatePayout.objects.filter(user=me).order_by('-created_at')[:10]
    return Response({
        'link': {
            'id': link.id, 'code': link.code, 'isActive': link.is_active,
            'totalClicks': link.total_clicks, 'totalConversions': link.total_conversions,
        } if link else None,
        'totalClicks': link.total_clicks if link else 0,
        'totalConversions': link.total_conversions if link else 0,
        'totalEarned': total_earned, 'pendingAmount': pending, 'paidAmount': paid,
        'commissions': [{
            'id': c.id, 'event': c.event,
            'amountUsd': float(c.amount_usd), 'status': c.status,
            'createdAt': c.created_at.isoformat(),
        } for c in commissions[:20]],
        'payouts': [{
            'id': p.id, 'amountUsd': float(p.amount_usd), 'method': p.method,
            'status': p.status, 'adminNote': p.admin_note,
            'createdAt': p.created_at.isoformat(),
        } for p in payouts],
    })


@api_view(['PUT'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def admin_settings(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    s = _get_settings()
    d = request.data or {}
    for src, dst in [('isActive', 'is_active'), ('commissionRate', 'commission_rate'),
                     ('subCommissionRate', 'sub_commission_rate'),
                     ('cookieDays', 'cookie_days'), ('minPayoutUsd', 'min_payout_usd')]:
        if src in d:
            setattr(s, dst, d[src])
    if 'allowedEvents' in d:
        ev = d['allowedEvents']
        s.allowed_events = ','.join(ev) if isinstance(ev, list) else ev
    s.save()
    return Response({'settings': {
        'isActive': s.is_active,
        'commissionRate': float(s.commission_rate),
        'subCommissionRate': float(s.sub_commission_rate),
        'cookieDays': s.cookie_days,
        'minPayoutUsd': float(s.min_payout_usd),
        'allowedEvents': s.allowed_events,
    }})


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def admin_links(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    links = AffiliateLink.objects.select_related('user').order_by('-total_clicks')[:100]
    return Response({'links': [{
        'id': l.id, 'code': l.code, 'isActive': l.is_active,
        'totalClicks': l.total_clicks, 'totalConversions': l.total_conversions,
        'totalEarnedUsd': float(l.total_earned_usd),
        'createdAt': l.created_at.isoformat(),
        'user': {
            'id': l.user.id, 'username': l.user.username,
            'displayName': l.user.display_name, 'avatarUrl': l.user.avatar_url,
        },
    } for l in links]})


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def admin_commissions(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    c = AffiliateCommission.objects.order_by('-created_at')[:200]
    return Response({'commissions': [{
        'id': x.id, 'affiliateUserId': x.affiliate_user_id,
        'referredUserId': x.referred_user_id, 'event': x.event,
        'amountUsd': float(x.amount_usd), 'status': x.status,
        'createdAt': x.created_at.isoformat(),
    } for x in c]})


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def admin_payouts(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    payouts = AffiliatePayout.objects.select_related('user').order_by('-created_at')[:100]
    return Response({'payouts': [{
        'id': p.id, 'amountUsd': float(p.amount_usd), 'method': p.method,
        'details': p.details, 'status': p.status, 'adminNote': p.admin_note,
        'createdAt': p.created_at.isoformat(),
        'user': {
            'id': p.user.id, 'username': p.user.username,
            'displayName': p.user.display_name,
        },
    } for p in payouts]})


@api_view(['PATCH'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def admin_payout_detail(request, payout_id):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    try:
        p = AffiliatePayout.objects.get(id=payout_id)
    except AffiliatePayout.DoesNotExist:
        return Response({'error': 'Bulunamadı'}, status=404)
    d = request.data or {}
    if 'status' in d:
        p.status = d['status']
    if 'adminNote' in d:
        p.admin_note = d['adminNote']
    p.save()
    return Response({'payout': {
        'id': p.id, 'status': p.status, 'adminNote': p.admin_note,
    }})


@api_view(['PATCH'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def admin_link_detail(request, link_id):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    try:
        l = AffiliateLink.objects.get(id=link_id)
    except AffiliateLink.DoesNotExist:
        return Response({'error': 'Bulunamadı'}, status=404)
    if 'isActive' in (request.data or {}):
        l.is_active = bool(request.data['isActive'])
        l.save(update_fields=['is_active'])
    return Response({'link': {
        'id': l.id, 'code': l.code, 'isActive': l.is_active,
    }})
