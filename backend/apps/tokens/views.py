from django.db.models import Sum, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .models import TokenPackage, TokenTransaction, WithdrawalRequest

COMMISSION_RATE = 0.20
TOKEN_TO_USD = 0.01


def get_balance(user_id):
    result = TokenTransaction.objects.filter(
        user_id=user_id, status='completed'
    ).aggregate(total=Sum('amount'))
    return result['total'] or 0


@api_view(['GET'])
@permission_classes([AllowAny])
def list_packages(request):
    pkgs = TokenPackage.objects.filter(is_active=True).order_by('tokens')
    return Response({'packages': [{
        'id': p.id, 'name': p.name, 'tokens': p.tokens,
        'priceUsd': float(p.price_usd), 'bonus': p.bonus, 'isPopular': p.is_popular,
    } for p in pkgs]})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_balance_view(request):
    balance = get_balance(request.user.id)
    return Response({'balance': balance})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def purchase_tokens(request):
    pkg_id = request.data.get('packageId', request.data.get('package_id'))
    if not pkg_id:
        return Response({'error': 'packageId gerekli'}, status=400)
    try:
        pkg = TokenPackage.objects.get(id=pkg_id, is_active=True)
    except TokenPackage.DoesNotExist:
        return Response({'error': 'Paket bulunamadı'}, status=404)
    total = pkg.tokens + pkg.bonus
    tx = TokenTransaction.objects.create(
        user=request.user,
        type='purchase',
        amount=total,
        usd_value=pkg.price_usd,
        description=f'{pkg.name} paketi satın alındı',
    )
    return Response({
        'message': f'{total} token hesabınıza eklendi',
        'balance': get_balance(request.user.id),
        'transaction': {'id': tx.id, 'amount': tx.amount},
    }, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def tip_creator(request):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    creator_id = request.data.get('creatorId', request.data.get('creator_id'))
    amount = int(request.data.get('amount', 0))
    if not creator_id or amount <= 0:
        return Response({'error': 'creatorId ve amount gerekli'}, status=400)
    try:
        creator = User.objects.get(id=creator_id)
    except User.DoesNotExist:
        return Response({'error': 'Creator bulunamadı'}, status=404)
    balance = get_balance(request.user.id)
    if balance < amount:
        return Response({'error': 'Yetersiz bakiye'}, status=400)
    creator_amount = int(amount * (1 - COMMISSION_RATE))
    TokenTransaction.objects.create(
        user=request.user, type='tip', amount=-amount,
        usd_value=amount * TOKEN_TO_USD,
        related_user=creator,
        description=f'{creator.username} için token gönderildi',
    )
    TokenTransaction.objects.create(
        user=creator, type='receive', amount=creator_amount,
        usd_value=creator_amount * TOKEN_TO_USD,
        related_user=request.user,
        description=f'{request.user.username} tarafından token alındı',
    )
    return Response({
        'message': f'{amount} token gönderildi',
        'balance': get_balance(request.user.id),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def transaction_history(request):
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    txs = TokenTransaction.objects.filter(user=request.user).order_by('-created_at')
    total = txs.count()
    items = list(txs[offset:offset + limit])
    return Response({
        'transactions': [{
            'id': t.id, 'type': t.type, 'amount': t.amount,
            'usdValue': float(t.usd_value), 'description': t.description,
            'status': t.status, 'createdAt': t.created_at.isoformat(),
        } for t in items],
        'total': total,
        'balance': get_balance(request.user.id),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_withdrawal(request):
    user = request.user
    if user.role not in ('creator', 'admin'):
        return Response({'error': 'Creator hesabı gerekli'}, status=403)
    token_amount = int(request.data.get('tokenAmount', request.data.get('token_amount', 0)))
    if token_amount <= 0:
        return Response({'error': 'tokenAmount gerekli'}, status=400)
    balance = get_balance(user.id)
    if balance < token_amount:
        return Response({'error': 'Yetersiz bakiye'}, status=400)
    usd_amount = round(token_amount * TOKEN_TO_USD * (1 - COMMISSION_RATE), 2)
    wr = WithdrawalRequest.objects.create(
        creator=user,
        token_amount=token_amount,
        usd_amount=usd_amount,
        method=request.data.get('method', 'bank'),
        details=request.data.get('details', ''),
    )
    return Response({
        'id': wr.id, 'tokenAmount': wr.token_amount,
        'usdAmount': float(wr.usd_amount), 'status': wr.status,
    }, status=201)
