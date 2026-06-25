from datetime import datetime
from django.utils import timezone
from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import TokenTransaction, TokenPackage, WithdrawalRequest
from .views import get_balance, TOKEN_TO_USD, COMMISSION_RATE


def _is_admin(u):
    return u.is_authenticated and getattr(u, 'role', '') == 'admin'


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def creator_earnings(request):
    me = request.user
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total = TokenTransaction.objects.filter(
        user=me, type='receive', status='completed',
    ).aggregate(t=Sum('amount'))['t'] or 0
    this_month = TokenTransaction.objects.filter(
        user=me, type='receive', status='completed', created_at__gte=month_start,
    ).aggregate(t=Sum('amount'))['t'] or 0
    balance = get_balance(me.id)
    recent_qs = TokenTransaction.objects.filter(
        user=me, type='receive',
    ).select_related('related_user').order_by('-created_at')[:10]
    recent = []
    for tx in recent_qs:
        s = tx.related_user
        recent.append({
            'id': tx.id, 'amount': tx.amount, 'usdValue': float(tx.usd_value),
            'description': tx.description,
            'createdAt': tx.created_at.isoformat(),
            'sender': {'username': s.username, 'displayName': s.display_name, 'avatarUrl': s.avatar_url} if s else None,
        })
    withdrawals = []
    for w in WithdrawalRequest.objects.filter(creator=me).order_by('-created_at')[:10]:
        withdrawals.append({
            'id': w.id, 'tokenAmount': w.token_amount, 'usdAmount': float(w.usd_amount),
            'method': w.method, 'status': w.status, 'adminNote': w.admin_note,
            'createdAt': w.created_at.isoformat(),
        })
    return Response({
        'balance': balance, 'totalEarned': total, 'thisMonth': this_month,
        'availableUsd': round(balance * TOKEN_TO_USD, 2),
        'tokenToUsd': TOKEN_TO_USD, 'commissionRate': COMMISSION_RATE,
        'recentTips': recent, 'withdrawals': withdrawals,
    })


def _fmt_pkg(p):
    return {
        'id': p.id, 'name': p.name, 'tokens': p.tokens,
        'priceUsd': float(p.price_usd), 'bonus': p.bonus,
        'isPopular': p.is_popular, 'isActive': p.is_active,
    }


@api_view(['GET', 'POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def admin_packages(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    if request.method == 'POST':
        d = request.data or {}
        if not d.get('name') or d.get('tokens') is None or d.get('priceUsd') is None:
            return Response({'error': 'name, tokens, priceUsd gerekli'}, status=400)
        p = TokenPackage.objects.create(
            name=d['name'], tokens=int(d['tokens']),
            price_usd=d['priceUsd'], bonus=int(d.get('bonus', 0)),
            is_popular=bool(d.get('isPopular', False)),
        )
        return Response({'package': _fmt_pkg(p)})
    pkgs = TokenPackage.objects.all().order_by('tokens')
    return Response({'packages': [_fmt_pkg(p) for p in pkgs]})


@api_view(['PUT', 'DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def admin_package_detail(request, pkg_id):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    try:
        p = TokenPackage.objects.get(id=pkg_id)
    except TokenPackage.DoesNotExist:
        return Response({'error': 'Bulunamadı'}, status=404)
    if request.method == 'DELETE':
        p.delete()
        return Response({'success': True})
    d = request.data or {}
    for src, dst in [('name', 'name'), ('tokens', 'tokens'), ('priceUsd', 'price_usd'),
                     ('bonus', 'bonus'), ('isPopular', 'is_popular'), ('isActive', 'is_active')]:
        if src in d:
            setattr(p, dst, d[src])
    p.save()
    return Response({'package': _fmt_pkg(p)})
