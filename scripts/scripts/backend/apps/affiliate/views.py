import secrets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .models import AffiliateSettings, AffiliateLink, AffiliateClick, AffiliateCommission, AffiliatePayout


@api_view(['GET'])
@permission_classes([AllowAny])
def get_settings(request):
    settings_obj, _ = AffiliateSettings.objects.get_or_create(id=1)
    return Response({
        'isActive': settings_obj.is_active,
        'commissionRate': float(settings_obj.commission_rate),
        'cookieDays': settings_obj.cookie_days,
        'minPayoutUsd': float(settings_obj.min_payout_usd),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_my_link(request):
    link = AffiliateLink.objects.filter(user=request.user).first()
    if not link:
        code = secrets.token_hex(6)
        link = AffiliateLink.objects.create(user=request.user, code=code)
    return Response({
        'id': link.id,
        'code': link.code,
        'isActive': link.is_active,
        'totalClicks': link.total_clicks,
        'totalConversions': link.total_conversions,
        'totalEarnedUsd': float(link.total_earned_usd),
        'referralUrl': f'/register?ref={link.code}',
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def track_click(request, code):
    try:
        link = AffiliateLink.objects.get(code=code, is_active=True)
    except AffiliateLink.DoesNotExist:
        return Response({'error': 'Link not found'}, status=404)
    ip = request.META.get('REMOTE_ADDR')
    user_agent = request.META.get('HTTP_USER_AGENT', '')
    AffiliateClick.objects.create(link=link, ip=ip, user_agent=user_agent)
    AffiliateLink.objects.filter(id=link.id).update(total_clicks=link.total_clicks + 1)
    return Response({'message': 'Click tracked'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_commissions(request):
    comms = AffiliateCommission.objects.filter(affiliate_user=request.user).order_by('-created_at')[:50]
    return Response({'commissions': [{
        'id': c.id, 'event': c.event, 'amountUsd': float(c.amount_usd),
        'status': c.status, 'createdAt': c.created_at.isoformat(),
    } for c in comms]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_payout(request):
    amount = float(request.data.get('amountUsd', request.data.get('amount_usd', 0)))
    if amount <= 0:
        return Response({'error': 'amountUsd gerekli'}, status=400)
    payout = AffiliatePayout.objects.create(
        user=request.user,
        amount_usd=amount,
        method=request.data.get('method', 'bank'),
        details=request.data.get('details', ''),
    )
    return Response({'id': payout.id, 'amountUsd': float(payout.amount_usd), 'status': payout.status}, status=201)
