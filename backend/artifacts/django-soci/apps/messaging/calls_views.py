"""WebRTC call signaling endpoints (port of original Express /api/calls)."""
from django.db.models import Q
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Conversation, Message, CallSession


def _fmt_call(c, include_caller=False):
    data = {
        'id': c.id,
        'conversationId': c.conversation_id,
        'callerId': c.caller_id,
        'calleeId': c.callee_id,
        'callType': c.call_type,
        'status': c.status,
        'sdpOffer': c.sdp_offer,
        'sdpAnswer': c.sdp_answer,
        'callerIce': c.caller_ice or [],
        'calleeIce': c.callee_ice or [],
        'duration': c.duration,
        'startedAt': c.started_at.isoformat() if c.started_at else None,
        'answeredAt': c.answered_at.isoformat() if c.answered_at else None,
        'endedAt': c.ended_at.isoformat() if c.ended_at else None,
    }
    if include_caller:
        u = c.caller
        data['caller'] = {
            'id': u.id, 'username': u.username,
            'displayName': u.display_name, 'avatarUrl': u.avatar_url,
        }
    return data


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def call_start(request):
    me = request.user
    conv_id = request.data.get('conversationId')
    sdp_offer = request.data.get('sdpOffer')
    call_type = request.data.get('callType', 'audio')

    if not conv_id or not sdp_offer:
        return Response({'error': 'conversationId ve sdpOffer zorunlu'}, status=400)

    conv = Conversation.objects.filter(
        Q(id=conv_id) & (Q(user1=me) | Q(user2=me))
    ).first()
    if not conv:
        return Response({'error': 'Konuşma bulunamadı'}, status=404)

    callee = conv.user2 if conv.user1_id == me.id else conv.user1

    # End any currently-ringing call in this conversation
    CallSession.objects.filter(conversation=conv, status='ringing').update(
        status='ended', ended_at=timezone.now()
    )

    call = CallSession.objects.create(
        conversation=conv, caller=me, callee=callee,
        call_type=call_type if call_type in ('audio', 'video') else 'audio',
        status='ringing', sdp_offer=sdp_offer,
    )
    return Response({'call': _fmt_call(call)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def call_incoming(request):
    call = CallSession.objects.filter(callee=request.user, status='ringing').order_by('-started_at').first()
    if not call:
        return Response({'call': None})
    return Response({'call': _fmt_call(call, include_caller=True)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def call_get(request, call_id):
    me = request.user
    call = CallSession.objects.filter(
        Q(id=call_id) & (Q(caller=me) | Q(callee=me))
    ).first()
    if not call:
        return Response({'error': 'Arama bulunamadı'}, status=404)
    return Response({'call': _fmt_call(call)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def call_answer(request, call_id):
    sdp_answer = request.data.get('sdpAnswer')
    if not sdp_answer:
        return Response({'error': 'sdpAnswer zorunlu'}, status=400)
    call = CallSession.objects.filter(id=call_id, callee=request.user).first()
    if not call:
        return Response({'error': 'Arama bulunamadı'}, status=404)
    call.status = 'active'
    call.sdp_answer = sdp_answer
    call.answered_at = timezone.now()
    call.save(update_fields=['status', 'sdp_answer', 'answered_at'])
    return Response({'call': _fmt_call(call)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def call_ice(request, call_id):
    me = request.user
    candidate = request.data.get('candidate')
    if not candidate:
        return Response({'error': 'candidate zorunlu'}, status=400)
    call = CallSession.objects.filter(
        Q(id=call_id) & (Q(caller=me) | Q(callee=me))
    ).first()
    if not call:
        return Response({'error': 'Arama bulunamadı'}, status=404)
    if call.caller_id == me.id:
        call.caller_ice = (call.caller_ice or []) + [candidate]
        call.save(update_fields=['caller_ice'])
    else:
        call.callee_ice = (call.callee_ice or []) + [candidate]
        call.save(update_fields=['callee_ice'])
    return Response({'ok': True})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def call_end(request, call_id):
    me = request.user
    raw = request.data.get('rejected', False)
    rejected = raw is True or str(raw).lower() in ('true', '1', 'yes')
    call = CallSession.objects.filter(
        Q(id=call_id) & (Q(caller=me) | Q(callee=me))
    ).first()
    if not call:
        return Response({'error': 'Arama bulunamadı'}, status=404)

    was_active = call.status == 'active'
    now = timezone.now()
    duration = None
    if call.answered_at:
        duration = int((now - call.answered_at).total_seconds())
    call.status = 'rejected' if rejected else 'ended'
    call.ended_at = now
    call.duration = duration
    call.save(update_fields=['status', 'ended_at', 'duration'])

    if was_active and duration is not None:
        mins, secs = divmod(duration, 60)
        label = 'Görüntülü arama' if call.call_type == 'video' else 'Sesli arama'
        dur_label = f'{mins} dk {secs} sn' if mins > 0 else f'{secs} sn'
        Message.objects.create(
            conversation=call.conversation, sender=me,
            content=f'{label} — {dur_label}',
            message_type='call', call_duration=duration,
        )
        call.conversation.last_message_at = now
        call.conversation.save(update_fields=['last_message_at'])

    return Response({'ok': True})
