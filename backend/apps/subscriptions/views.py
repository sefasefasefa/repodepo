from django.utils import timezone
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .models import SubscriptionPlan, UserSubscription, Payment


def _fmt_plan(p):
    return {
        'id': p.id, 'name': p.name, 'description': p.description,
        'price': float(p.price), 'billingCycle': p.billing_cycle,
        'features': p.features or [], 'isPopular': p.is_popular, 'isActive': p.is_active,
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def list_plans(request):
    plans = SubscriptionPlan.objects.filter(is_active=True)
    return Response({'plans': list(map(_fmt_plan, plans))})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_list_plans(request):
    if request.user.role != 'admin':
        return Response({'error': 'Yetkisiz'}, status=403)
    plans = SubscriptionPlan.objects.all().order_by('id')
    return Response({'plans': list(map(_fmt_plan, plans))})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_create_plan(request):
    if request.user.role != 'admin':
        return Response({'error': 'Yetkisiz'}, status=403)
    d = request.data
    if not d.get('name') or d.get('price') is None:
        return Response({'error': 'name ve price zorunlu'}, status=400)
    plan = SubscriptionPlan.objects.create(
        name=d['name'],
        description=d.get('description', ''),
        price=float(d['price']),
        billing_cycle=d.get('billingCycle', 'monthly'),
        features=d.get('features', []),
        is_popular=bool(d.get('isPopular', False)),
        is_active=bool(d.get('isActive', True)),
    )
    return Response({'plan': _fmt_plan(plan)}, status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def admin_plan_detail(request, plan_id):
    if request.user.role != 'admin':
        return Response({'error': 'Yetkisiz'}, status=403)
    try:
        plan = SubscriptionPlan.objects.get(id=plan_id)
    except SubscriptionPlan.DoesNotExist:
        return Response({'error': 'Plan bulunamadı'}, status=404)

    if request.method == 'DELETE':
        plan.delete()
        return Response({'message': 'silindi'})

    d = request.data
    if 'name' in d:
        plan.name = d['name']
    if 'description' in d:
        plan.description = d['description']
    if 'price' in d:
        plan.price = float(d['price'])
    if 'billingCycle' in d:
        plan.billing_cycle = d['billingCycle']
    if 'features' in d:
        plan.features = d['features']
    if 'isPopular' in d:
        plan.is_popular = bool(d['isPopular'])
    if 'isActive' in d:
        plan.is_active = bool(d['isActive'])
    plan.save()
    return Response({'plan': _fmt_plan(plan)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_subscription(request):
    sub = UserSubscription.objects.filter(user=request.user).order_by('-created_at').first()
    if not sub:
        # 200 + null is the modern convention — avoids noisy 404 logs and
        # lets the client treat "no subscription" as a normal state.
        return Response({'subscription': None})
    return Response({'subscription': {
        'id': sub.id,
        'planId': sub.plan_id,
        'plan': _fmt_plan(sub.plan),
        'status': sub.status,
        'currentPeriodStart': sub.current_period_start.isoformat(),
        'currentPeriodEnd': sub.current_period_end.isoformat(),
        'cancelAtPeriodEnd': sub.cancel_at_period_end,
    }})


@api_view(['GET'])
@permission_classes([AllowAny])
def check_access(request):
    if not request.user.is_authenticated:
        return Response({'hasAccess': False})
    if request.user.role in ('admin', 'creator'):
        return Response({'hasAccess': True, 'reason': 'role'})
    now = timezone.now()
    sub = UserSubscription.objects.filter(
        user=request.user, status='active', current_period_end__gt=now
    ).first()
    if sub:
        return Response({'hasAccess': True, 'reason': 'subscription'})
    return Response({'hasAccess': False, 'reason': 'none'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def subscribe(request):
    plan_id = request.data.get('planId', request.data.get('plan_id'))
    if not plan_id:
        return Response({'error': 'planId required'}, status=400)
    try:
        plan = SubscriptionPlan.objects.get(id=plan_id, is_active=True)
    except SubscriptionPlan.DoesNotExist:
        return Response({'error': 'Plan not found'}, status=404)

    period_end = timezone.now() + timezone.timedelta(days=30 if plan.billing_cycle == 'monthly' else 365)
    sub = UserSubscription.objects.create(
        user=request.user, plan=plan, current_period_end=period_end
    )
    Payment.objects.create(
        user=request.user, type='subscription', amount=plan.price,
        description=f'{plan.name} aboneliği'
    )
    return Response({
        'id': sub.id, 'planId': sub.plan_id, 'status': sub.status,
        'currentPeriodEnd': sub.current_period_end.isoformat(),
    }, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_tip(request):
    from apps.tokens.models import TokenTransaction
    data = request.data
    recipient_id = data.get('creatorId', data.get('creator_id', data.get('userId', data.get('user_id'))))
    amount = float(data.get('amount', 0))
    if not recipient_id or amount <= 0:
        return Response({'error': 'creatorId ve amount gerekli'}, status=400)

    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        recipient = User.objects.get(id=recipient_id)
    except User.DoesNotExist:
        return Response({'error': 'Creator not found'}, status=404)

    Payment.objects.create(
        user=request.user, type='tip', amount=amount,
        description=f'{recipient.username} için bahşiş', recipient=recipient
    )
    return Response({'message': 'Bahşiş gönderildi', 'amount': amount})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def payment_history(request):
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 20)), 50)
    offset = (page - 1) * limit
    payments = Payment.objects.filter(user=request.user).order_by('-created_at')
    total = payments.count()
    items = list(payments[offset:offset + limit])
    return Response({
        'payments': [{
            'id': p.id, 'type': p.type, 'amount': float(p.amount),
            'status': p.status, 'description': p.description,
            'createdAt': p.created_at.isoformat(),
        } for p in items],
        'total': total,
    })
