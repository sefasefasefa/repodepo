"""Admin payment gateway CRUD + public active gateway listing.
Mirrors api-server/src/routes/payments.ts."""
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import PaymentGateway
from apps.subscriptions.models import Payment


def _is_admin(u):
    return u.is_authenticated and getattr(u, 'role', '') in ('admin', 'moderator')


def _fmt_gw(g, mask=True):
    return {
        'id': str(g.id), 'type': g.type, 'name': g.name,
        'publicKey': g.public_key,
        'secretKey': 'sk_••••••••' if mask and g.secret_key else None,
        'apiKey': '••••••••' if mask and g.api_key else None,
        'merchantId': g.merchant_id, 'walletAddress': g.wallet_address,
        'network': g.network, 'isTestMode': g.is_test_mode,
        'isActive': g.is_active, 'isDefault': g.is_default,
        'currency': g.currency, 'addedAt': g.added_at.isoformat(),
        'totalVolume': float(g.total_volume), 'txCount': g.tx_count,
    }


@api_view(['GET', 'POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def gateways(request):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    if request.method == 'POST':
        d = request.data or {}
        if not d.get('type') or not d.get('name'):
            return Response({'error': 'type ve name zorunlu'}, status=400)
        gw = PaymentGateway.objects.create(
            type=d['type'], name=d['name'],
            public_key=d.get('publicKey'), secret_key=d.get('secretKey'),
            api_key=d.get('apiKey'), merchant_id=d.get('merchantId'),
            wallet_address=d.get('walletAddress'), network=d.get('network'),
            is_test_mode=bool(d.get('isTestMode', True)),
            currency=d.get('currency', 'USD'),
            is_default=(PaymentGateway.objects.count() == 0),
        )
        return Response({'gateway': _fmt_gw(gw)})
    return Response({'gateways': [_fmt_gw(g) for g in PaymentGateway.objects.all()]})


@api_view(['DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def gateway_delete(request, gw_id):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    deleted, _ = PaymentGateway.objects.filter(id=gw_id).delete()
    if not deleted:
        return Response({'error': 'Bulunamadı'}, status=404)
    return Response({'message': 'Silindi'})


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def gateway_set_default(request, gw_id):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    PaymentGateway.objects.all().update(is_default=False)
    updated = PaymentGateway.objects.filter(id=gw_id).update(is_default=True)
    if not updated:
        return Response({'error': 'Bulunamadı'}, status=404)
    return Response({'message': 'Varsayılan güncellendi'})


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def gateway_toggle(request, gw_id):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        gw = PaymentGateway.objects.get(id=gw_id)
    except PaymentGateway.DoesNotExist:
        return Response({'error': 'Bulunamadı'}, status=404)
    gw.is_active = not gw.is_active
    gw.save(update_fields=['is_active'])
    return Response({'isActive': gw.is_active})


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def transactions(request):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    limit = int(request.GET.get('limit', 50))
    qs = Payment.objects.order_by('-created_at')[:limit]
    total = Payment.objects.count()
    from django.db.models import Sum, Count, Q
    agg = Payment.objects.aggregate(
        total_vol=Sum('amount'),
        pending=Count('id', filter=Q(status='pending')),
        completed=Count('id', filter=Q(status='completed')),
        failed=Count('id', filter=Q(status='failed')),
    )
    return Response({
        'transactions': [{
            'id': p.id, 'type': p.type, 'amount': float(p.amount),
            'status': p.status, 'description': p.description,
            'createdAt': p.created_at.isoformat(),
        } for p in qs],
        'total': total,
        'totalVolume': float(agg['total_vol'] or 0),
        'pending': agg['pending'] or 0,
        'completed': agg['completed'] or 0,
        'failed': agg['failed'] or 0,
    })


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def gateway_test(request, gw_id):
    if not _is_admin(request.user):
        return Response({'error': 'Forbidden'}, status=403)
    try:
        gw = PaymentGateway.objects.get(id=gw_id)
    except PaymentGateway.DoesNotExist:
        return Response({'error': 'Bulunamadı'}, status=404)
    if gw.type == 'stripe':
        if not gw.secret_key:
            return Response({'ok': False, 'error': 'Secret key eksik'})
        try:
            import urllib.request
            req = urllib.request.Request(
                'https://api.stripe.com/v1/balance',
                headers={'Authorization': f'Bearer {gw.secret_key}'},
            )
            with urllib.request.urlopen(req, timeout=8) as r:
                if r.status == 200:
                    return Response({'ok': True, 'info': {'message': 'Stripe bağlandı'}})
                return Response({'ok': False, 'error': f'HTTP {r.status}'})
        except Exception as e:
            return Response({'ok': False, 'error': str(e)})
    if gw.type == 'paypal':
        return Response({'ok': True, 'info': {'message': 'PayPal ayarları kaydedildi (sandbox)'}})
    if gw.type == 'crypto':
        return Response({'ok': True, 'info': {'address': gw.wallet_address, 'network': gw.network}})
    if gw.type == 'papara':
        return Response({'ok': True, 'info': {'message': 'Papara ayarları kaydedildi'}})
    return Response({'ok': False, 'error': 'Desteklenmeyen ödeme sistemi'})


@api_view(['GET'])
@permission_classes([AllowAny])
def active_gateways(request):
    qs = PaymentGateway.objects.filter(is_active=True)
    return Response({'gateways': [
        {'id': str(g.id), 'type': g.type, 'name': g.name,
         'currency': g.currency, 'isTestMode': g.is_test_mode}
        for g in qs
    ]})
