"""Custom requests — accept/reject/complete/cancel + admin + stats."""
from datetime import timedelta
from django.db.models import Sum
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import CustomRequest
from apps.accounts.views import format_user
from apps.tokens.models import TokenTransaction

TOKEN_TO_USD = 0.01
COMMISSION_RATE = 0.20


def _admin(u):
    return u.is_authenticated and u.role == 'admin'


def _balance(user_id):
    total = TokenTransaction.objects.filter(
        user_id=user_id, status='completed'
    ).aggregate(s=Sum('amount'))['s']
    return int(total or 0)


def _fmt(r, include='neither'):
    base = {
        'id': r.id, 'title': r.title, 'description': r.description,
        'tokenOffer': r.token_offer, 'status': r.status,
        'responseNote': r.response_note,
        'completedVideoId': r.completed_video_id,
        'fromUserId': r.from_user_id, 'toCreatorId': r.to_creator_id,
        'expiresAt': r.expires_at.isoformat() if r.expires_at else None,
        'createdAt': r.created_at.isoformat() if r.created_at else None,
    }
    if include == 'creator':
        base['creator'] = format_user(r.to_creator)
    elif include == 'sender':
        base['sender'] = format_user(r.from_user)
    return base


# ── Create ──────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_request(request):
    me = request.user
    to_creator_id = request.data.get('toCreatorId') or request.data.get('to_creator_id')
    title = (request.data.get('title') or '').strip()
    description = (request.data.get('description') or '').strip()
    if not to_creator_id or not title or not description:
        return Response({'error': 'toCreatorId, title ve description zorunlu'}, status=400)
    if int(to_creator_id) == me.id:
        return Response({'error': 'Kendinize istek gönderemezsiniz'}, status=400)

    try:
        offer = max(0, int(request.data.get('tokenOffer') or request.data.get('token_offer') or 0))
    except (TypeError, ValueError):
        offer = 0

    if offer > 0:
        bal = _balance(me.id)
        if bal < offer:
            return Response({'error': f'Yetersiz bakiye ({bal} token mevcut)'}, status=400)
        TokenTransaction.objects.create(
            user=me, type='freeze', amount=-offer,
            usd_value=round(offer * TOKEN_TO_USD, 4),
            related_user_id=int(to_creator_id),
            description=f'Özel istek rezervasyonu: {title}',
            status='completed',
        )

    req = CustomRequest.objects.create(
        from_user=me, to_creator_id=int(to_creator_id),
        title=title, description=description, token_offer=offer,
        expires_at=timezone.now() + timedelta(days=7),
    )
    return Response({'request': _fmt(req)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sent(request):
    qs = (CustomRequest.objects.filter(from_user=request.user)
          .select_related('to_creator').order_by('-created_at'))
    return Response({'requests': [_fmt(r, include='creator') for r in qs]})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def received(request):
    qs = (CustomRequest.objects.filter(to_creator=request.user)
          .select_related('from_user').order_by('-created_at'))
    return Response({'requests': [_fmt(r, include='sender') for r in qs]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept(request, req_id):
    r = CustomRequest.objects.filter(id=req_id, to_creator=request.user).first()
    if not r:
        return Response({'error': 'İstek bulunamadı'}, status=404)
    if r.status != 'pending':
        return Response({'error': 'Yalnızca bekleyen istekler kabul edilebilir'}, status=400)
    r.status = 'accepted'
    r.response_note = request.data.get('responseNote') or r.response_note
    r.save(update_fields=['status', 'response_note', 'updated_at'])
    return Response({'request': _fmt(r)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject(request, req_id):
    r = CustomRequest.objects.filter(id=req_id, to_creator=request.user).first()
    if not r:
        return Response({'error': 'İstek bulunamadı'}, status=404)
    if r.status not in ('pending', 'accepted'):
        return Response({'error': 'Bu istek artık reddedilemez'}, status=400)

    if r.token_offer > 0:
        TokenTransaction.objects.create(
            user_id=r.from_user_id, type='refund', amount=r.token_offer,
            usd_value=round(r.token_offer * TOKEN_TO_USD, 4),
            related_user_id=request.user.id,
            description=f'Özel istek reddedildi — iade: {r.title}',
            status='completed',
        )

    r.status = 'rejected'
    r.response_note = request.data.get('responseNote') or r.response_note
    r.save(update_fields=['status', 'response_note', 'updated_at'])
    return Response({'request': _fmt(r)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete(request, req_id):
    r = CustomRequest.objects.filter(id=req_id, to_creator=request.user).first()
    if not r:
        return Response({'error': 'İstek bulunamadı'}, status=404)
    if r.status != 'accepted':
        return Response({'error': 'Yalnızca kabul edilmiş istekler tamamlanabilir'}, status=400)

    if r.token_offer > 0:
        commission = int(r.token_offer * COMMISSION_RATE)
        share = r.token_offer - commission
        TokenTransaction.objects.create(
            user=request.user, type='receive', amount=share,
            usd_value=round(share * TOKEN_TO_USD, 4),
            related_user_id=r.from_user_id,
            description=f'Özel istek tamamlandı: {r.title}',
            status='completed',
        )

    r.status = 'completed'
    if request.data.get('responseNote'):
        r.response_note = request.data['responseNote']
    cv = request.data.get('completedVideoId')
    if cv:
        try:
            r.completed_video_id = int(cv)
        except (TypeError, ValueError):
            pass
    r.save()
    return Response({'request': _fmt(r)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancel(request, req_id):
    r = CustomRequest.objects.filter(id=req_id, from_user=request.user).first()
    if not r:
        return Response({'error': 'İstek bulunamadı'}, status=404)
    if r.status != 'pending':
        return Response({'error': 'Yalnızca bekleyen istekler iptal edilebilir'}, status=400)

    if r.token_offer > 0:
        TokenTransaction.objects.create(
            user=request.user, type='refund', amount=r.token_offer,
            usd_value=round(r.token_offer * TOKEN_TO_USD, 4),
            description=f'Özel istek iptal edildi — iade: {r.title}',
            status='completed',
        )

    r.status = 'cancelled'
    r.save(update_fields=['status', 'updated_at'])
    return Response({'request': _fmt(r)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_list(request):
    if not _admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    rows = CustomRequest.objects.order_by('-created_at')[:200]
    return Response({'requests': [_fmt(r) for r in rows]})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stats(request):
    me = request.user
    all_rows = list(CustomRequest.objects.filter(to_creator=me).values_list('status', 'token_offer'))
    pending = sum(1 for s, _ in all_rows if s == 'pending')
    accepted = sum(1 for s, _ in all_rows if s == 'accepted')
    completed = sum(1 for s, _ in all_rows if s == 'completed')
    rejected = sum(1 for s, _ in all_rows if s == 'rejected')
    total_earned = sum(int(o * (1 - COMMISSION_RATE)) for s, o in all_rows if s == 'completed')
    return Response({
        'pending': pending, 'accepted': accepted, 'completed': completed,
        'rejected': rejected, 'totalEarned': total_earned,
    })
