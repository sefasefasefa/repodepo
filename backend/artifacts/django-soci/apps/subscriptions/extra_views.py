from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import UserSubscription, Payment


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def cancel_subscription(request):
    UserSubscription.objects.filter(user=request.user).update(
        cancel_at_period_end=True, status='cancelled',
    )
    return Response({'message': 'Subscription cancelled'})


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def ppv_purchase(request, video_id):
    Payment.objects.create(
        user=request.user, type='ppv', amount='4.99',
        status='completed', description=f'Pay-per-view access to video #{video_id}',
    )
    return Response({'message': 'Access granted'})


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def creator_earnings(request):
    me = request.user
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1)

    all_p = Payment.objects.filter(recipient=me)
    total = float(all_p.aggregate(s=Sum('amount'))['s'] or 0)
    this_month = float(all_p.filter(created_at__gte=month_start).aggregate(s=Sum('amount'))['s'] or 0)
    last_month = float(all_p.filter(created_at__gte=last_month_start, created_at__lt=month_start).aggregate(s=Sum('amount'))['s'] or 0)
    tip_rev = float(all_p.filter(type='tip').aggregate(s=Sum('amount'))['s'] or 0)
    ppv_rev = float(all_p.filter(type='ppv').aggregate(s=Sum('amount'))['s'] or 0)

    history = []
    for i in range(12):
        m_start = (month_start - timedelta(days=30 * (11 - i))).replace(day=1)
        history.append({'date': m_start.strftime('%Y-%m'), 'amount': 0})

    return Response({
        'totalEarnings': total, 'pendingPayout': round(total * 0.1, 2),
        'thisMonth': this_month, 'lastMonth': last_month,
        'subscriptionRevenue': 0, 'tipRevenue': tip_rev, 'ppvRevenue': ppv_rev,
        'earningsHistory': history,
    })
