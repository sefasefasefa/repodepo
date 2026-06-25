from django.db.models import Q, Max, F
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Conversation, Message
from apps.accounts.views import format_user
from django.contrib.auth import get_user_model

User = get_user_model()


def _get_or_create_conversation(user_a_id, user_b_id):
    u1, u2 = sorted([user_a_id, user_b_id])
    conv, _ = Conversation.objects.get_or_create(user1_id=u1, user2_id=u2)
    return conv


def _require_participant(conv, user):
    """Return True if user is a participant of conv, else False."""
    return conv.user1_id == user.id or conv.user2_id == user.id


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_conversations(request):
    me = request.user
    convs = Conversation.objects.filter(
        Q(user1=me) | Q(user2=me)
    ).select_related('user1', 'user2').order_by('-last_message_at')

    result = []
    for c in convs:
        other = c.user2 if c.user1_id == me.id else c.user1
        last_msg = Message.objects.filter(
            conversation=c, deleted_by_sender=False, deleted_by_receiver=False
        ).order_by('-created_at').first()
        unread = Message.objects.filter(
            conversation=c, is_read=False, deleted_by_receiver=False
        ).exclude(sender=me).count()
        result.append({
            'id': c.id,
            'otherUser': format_user(other),
            'lastMessage': {
                'content': last_msg.content,
                'createdAt': last_msg.created_at.isoformat(),
                'senderId': last_msg.sender_id,
            } if last_msg else None,
            'unreadCount': unread,
            'lastMessageAt': c.last_message_at.isoformat(),
        })
    return Response({'conversations': result})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_conversation(request, user_id):
    # Validate target user BEFORE any conversation creation to avoid FK errors.
    try:
        other = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)

    conv = _get_or_create_conversation(request.user.id, user_id)
    return Response({
        'id': conv.id,
        'otherUser': format_user(other),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_messages(request, conversation_id):
    me = request.user
    page = int(request.query_params.get('page', 1))
    limit = min(int(request.query_params.get('limit', 50)), 100)
    offset = (page - 1) * limit

    try:
        conv = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        return Response({'error': 'Conversation not found'}, status=404)

    if not _require_participant(conv, me):
        return Response({'error': 'Forbidden'}, status=403)

    msgs = Message.objects.filter(
        conversation=conv
    ).exclude(
        Q(sender=me, deleted_by_sender=True) | Q(deleted_by_receiver=True)
    ).select_related('sender').order_by('-created_at')

    total = msgs.count()
    items = list(msgs[offset:offset + limit])
    Message.objects.filter(conversation=conv, is_read=False).exclude(sender=me).update(is_read=True)

    return Response({
        'messages': [{
            'id': m.id,
            'sender': format_user(m.sender),
            'content': m.content,
            'messageType': m.message_type,
            'isRead': m.is_read,
            'createdAt': m.created_at.isoformat(),
        } for m in reversed(items)],
        'total': total,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message(request, conversation_id):
    me = request.user
    try:
        conv = Conversation.objects.get(id=conversation_id)
    except Conversation.DoesNotExist:
        return Response({'error': 'Conversation not found'}, status=404)
    if not _require_participant(conv, me):
        return Response({'error': 'Forbidden'}, status=403)

    content = request.data.get('content', '').strip()
    if not content:
        return Response({'error': 'Content required'}, status=400)

    msg = Message.objects.create(
        conversation=conv, sender=me, content=content,
        message_type=request.data.get('messageType', 'text'),
    )
    Conversation.objects.filter(id=conversation_id).update(last_message_at=timezone.now())
    return Response({
        'id': msg.id,
        'sender': format_user(me),
        'content': msg.content,
        'messageType': msg.message_type,
        'isRead': msg.is_read,
        'createdAt': msg.created_at.isoformat(),
    }, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_message_to_user(request):
    user_id = request.data.get('userId', request.data.get('user_id'))
    if not user_id:
        return Response({'error': 'userId required'}, status=400)

    # Validate target user BEFORE creating conversation to prevent FK IntegrityError.
    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return Response({'error': 'Invalid userId'}, status=400)

    if not User.objects.filter(id=user_id).exists():
        return Response({'error': 'Target user not found'}, status=404)

    conv = _get_or_create_conversation(request.user.id, user_id)
    content = request.data.get('content', '').strip()
    if not content:
        return Response({'error': 'Content required'}, status=400)
    msg = Message.objects.create(
        conversation=conv, sender=request.user, content=content,
        message_type=request.data.get('messageType', 'text'),
    )
    Conversation.objects.filter(id=conv.id).update(last_message_at=timezone.now())
    return Response({'conversationId': conv.id, 'messageId': msg.id}, status=201)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_message(request, message_id):
    me = request.user
    try:
        msg = Message.objects.select_related('conversation').get(id=message_id)
    except Message.DoesNotExist:
        return Response({'error': 'Message not found'}, status=404)

    # Only conversation participants may delete/hide a message.
    conv = msg.conversation
    if not _require_participant(conv, me):
        return Response({'error': 'Forbidden'}, status=403)

    if msg.sender_id == me.id:
        msg.deleted_by_sender = True
    else:
        # Receiver may hide the message on their side only.
        msg.deleted_by_receiver = True
    msg.save()
    return Response({'message': 'Deleted'})
