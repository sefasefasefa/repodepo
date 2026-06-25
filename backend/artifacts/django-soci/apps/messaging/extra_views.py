from django.db.models import Q
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import Message, Conversation


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def unread_count(request):
    me = request.user
    my_convs = Conversation.objects.filter(Q(user1=me) | Q(user2=me)).values_list('id', flat=True)
    count = Message.objects.filter(
        conversation_id__in=list(my_convs),
        is_read=False,
        deleted_by_receiver=False,
        deleted_by_sender=False,
    ).exclude(sender=me).count()
    return Response({'count': count})
