from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth import get_user_model

User = get_user_model()


class BearerTokenAuthentication(BaseAuthentication):
    """
    Authenticate via session token stored in the DB (legacy compatibility with
    the original Node.js frontend). Also accepts SimpleJWT tokens — those are
    handled first by JWTAuthentication in the DRF authentication class list.
    """

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header.startswith('Bearer '):
            return None
        token = auth_header[7:].strip()
        if not token:
            return None

        # Skip JWT-looking tokens (they'll be handled by JWTAuthentication)
        if len(token) > 100:
            return None

        try:
            user = User.objects.get(session_token=token)
        except User.DoesNotExist:
            return None

        if user.is_banned:
            raise AuthenticationFailed('Hesabınız askıya alınmıştır.')
        return (user, token)
