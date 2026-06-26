import threading
from django.utils import timezone
from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import SubscriptionPlan, UserSubscription, Payment


def _broadcast_plan_notification(title: str, message: str, action_url: str = "/pricing"):
    """Tüm aktif kullanıcılara arka planda bildirim gönder."""
    def _send():
        try:
            from apps.notifications.models import Notification
            from django.contrib.auth import get_user_model
            User = get_user_model()
            users = User.objects.filter(is_active=True).values_list("id", flat=True)
            batch = [
                Notification(
                    user_id=uid,
                    type="subscription",
                    title=title,
                    message=message,
                    action_url=action_url,
                )
                for uid in users
            ]
            Notification.objects.bulk_create(batch, ignore_conflicts=True)
        except Exception:
            pass
    threading.Thread(target=_send, daemon=True).start()


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
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def admin_list_plans(request):
    if request.user.role != 'admin':
        return Response({'error': 'Yetkisiz'}, status=403)
    plans = SubscriptionPlan.objects.all().order_by('id')
    return Response({'plans': list(map(_fmt_plan, plans))})


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
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
    cycle_tr = {'monthly': 'aylık', 'yearly': 'yıllık', 'lifetime': 'ömür boyu'}.get(plan.billing_cycle, plan.billing_cycle)
    _broadcast_plan_notification(
        title=f"🎉 Yeni Plan: {plan.name}",
        message=f"{plan.name} planı artık mevcut! ${plan.price}/{cycle_tr} — {plan.description or 'Hemen keşfet'}",
        action_url="/pricing",
    )
    return Response({'plan': _fmt_plan(plan)}, status=201)


@api_view(['PATCH', 'DELETE'])
@authentication_classes([JWTAuthentication])
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
    if plan.is_active:
        cycle_tr = {'monthly': 'aylık', 'yearly': 'yıllık', 'lifetime': 'ömür boyu'}.get(plan.billing_cycle, plan.billing_cycle)
        _broadcast_plan_notification(
            title=f"✨ Plan Güncellendi: {plan.name}",
            message=f"{plan.name} planında değişiklikler yapıldı. Yeni fiyat: ${plan.price}/{cycle_tr}",
            action_url="/pricing",
        )
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_list_subscriptions(request):
    if request.user.role != 'admin':
        return Response({'error': 'Forbidden'}, status=403)
    from django.contrib.auth import get_user_model
    User = get_user_model()
    status_filter = request.query_params.get('status', '')
    search = request.query_params.get('search', '')
    page = int(request.query_params.get('page', 1))
    limit = 50
    offset = (page - 1) * limit

    qs = UserSubscription.objects.select_related('user', 'plan').order_by('-created_at')
    if status_filter:
        qs = qs.filter(status=status_filter)
    if search:
        qs = qs.filter(user__username__icontains=search)

    total = qs.count()
    items = list(qs[offset:offset + limit])
    stats = {
        'active': UserSubscription.objects.filter(status='active').count(),
        'cancelled': UserSubscription.objects.filter(status='cancelled').count(),
        'expired': UserSubscription.objects.filter(status='expired').count(),
        'revenue': float(
            sum(s.plan.price for s in UserSubscription.objects.filter(status='active').select_related('plan'))
        ),
    }
    return Response({
        'subscriptions': [{
            'id': s.id,
            'user': s.user.username,
            'plan': s.plan.name,
            'price': float(s.plan.price),
            'status': s.status,
            'start': s.current_period_start.strftime('%Y-%m-%d'),
            'end': s.current_period_end.strftime('%Y-%m-%d'),
            'method': 'Kart',
        } for s in items],
        'total': total,
        'stats': stats,
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def admin_gift_subscriptions(request):
    from .models import GiftSubscription
    from django.contrib.auth import get_user_model
    User = get_user_model()

    if request.method == 'GET':
        if request.user.role != 'admin':
            return Response({'error': 'Forbidden'}, status=403)
        qs = GiftSubscription.objects.select_related('sender', 'recipient', 'plan').order_by('-created_at')
        search = request.query_params.get('search', '')
        if search:
            qs = qs.filter(sender__username__icontains=search) | qs.filter(recipient__username__icontains=search)
        items = list(qs[:100])
        active_count = GiftSubscription.objects.filter(status='active').count()
        revenue = float(sum(
            g.plan.price * g.duration_months
            for g in GiftSubscription.objects.filter(status='active').select_related('plan')
        ))
        return Response({
            'gifts': [{
                'id': g.id,
                'senderUsername': g.sender.username,
                'recipientUsername': g.recipient.username,
                'plan': g.plan.name,
                'duration': g.duration_months,
                'sentAt': g.created_at.strftime('%Y-%m-%d'),
                'status': g.status,
            } for g in items],
            'stats': {
                'total': GiftSubscription.objects.count(),
                'active': active_count,
                'revenue': revenue,
            }
        })
    else:
        if request.user.role != 'admin':
            return Response({'error': 'Forbidden'}, status=403)
        data = request.data
        recipient_username = data.get('recipient', '').lstrip('@')
        plan_id = data.get('planId')
        duration = int(data.get('duration', 1))
        note = data.get('note', '')
        try:
            recipient = User.objects.get(username=recipient_username)
        except User.DoesNotExist:
            return Response({'error': 'Kullanıcı bulunamadı'}, status=404)
        try:
            plan = SubscriptionPlan.objects.get(id=plan_id)
        except SubscriptionPlan.DoesNotExist:
            return Response({'error': 'Plan bulunamadı'}, status=404)
        gift = GiftSubscription.objects.create(
            sender=request.user,
            recipient=recipient,
            plan=plan,
            duration_months=duration,
            note=note,
            status='active',
        )
        return Response({'id': gift.id, 'message': 'Hediye abonelik gönderildi'}, status=201)
