"""SMS-OTP based phone verification + Google OAuth endpoints."""
import os
import re
import secrets
import threading
import time
import urllib.parse
import urllib.request
import json
from datetime import timedelta

# Simple in-memory throttle (process-local). 5 sends / 15 min per phone or IP.
_throttle_lock = threading.Lock()
_throttle_hits = {}
SEND_WINDOW_S = 15 * 60
SEND_MAX = 5
VERIFY_WINDOW_S = 15 * 60
VERIFY_MAX = 10


def _throttled(key, window, limit):
    now = time.time()
    with _throttle_lock:
        hits = [t for t in _throttle_hits.get(key, []) if now - t < window]
        if len(hits) >= limit:
            return True
        hits.append(now)
        _throttle_hits[key] = hits
        return False


def _client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')
from django.utils import timezone
from django.shortcuts import redirect
from django.http import HttpResponseRedirect
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .views import format_user, get_jwt_tokens

User = get_user_model()
PHONE_RE = re.compile(r'^\+?[0-9]{8,15}$')


def _generate_otp():
    return f'{secrets.randbelow(900000) + 100000:06d}'


def _is_dev():
    return os.getenv('DJANGO_ENV', 'production').lower() in ('dev', 'development')


@api_view(['POST'])
@permission_classes([AllowAny])
def sms_send(request):
    phone = (request.data.get('phone') or '').strip()
    if not PHONE_RE.match(phone):
        return Response({'error': 'Geçerli bir telefon numarası girin (ör: +905xxxxxxxxx)'}, status=400)

    if _throttled(f'send:phone:{phone}', SEND_WINDOW_S, SEND_MAX) or \
       _throttled(f'send:ip:{_client_ip(request)}', SEND_WINDOW_S, SEND_MAX * 2):
        return Response({'error': 'Çok fazla istek. Lütfen daha sonra tekrar deneyin.'}, status=429)

    otp = _generate_otp()
    expires_at = timezone.now() + timedelta(minutes=10)
    # Update existing user with this phone (no leak about existence on response)
    User.objects.filter(phone=phone).update(sms_otp=otp, sms_otp_expires_at=expires_at)

    out = {'success': True, 'message': f'Doğrulama kodu {phone} numarasına gönderildi.'}
    if _is_dev():
        out['dev_otp'] = otp
    return Response(out)


@api_view(['POST'])
@permission_classes([AllowAny])
def sms_verify(request):
    phone = (request.data.get('phone') or '').strip()
    code = (request.data.get('code') or '').strip()
    if not phone or not code:
        return Response({'error': 'Telefon numarası ve kod zorunludur'}, status=400)

    if _throttled(f'verify:phone:{phone}', VERIFY_WINDOW_S, VERIFY_MAX) or \
       _throttled(f'verify:ip:{_client_ip(request)}', VERIFY_WINDOW_S, VERIFY_MAX * 2):
        return Response({'error': 'Çok fazla deneme. Lütfen daha sonra tekrar deneyin.'}, status=429)

    # Only verified phones are unique; if two unverified rows share a phone we
    # cannot tell which user the caller meant — refuse rather than guess.
    matches = User.objects.filter(phone=phone)
    if matches.count() > 1:
        verified = matches.filter(phone_verified=True).first()
        if not verified:
            return Response(
                {'error': 'Bu numara birden fazla hesapla ilişkili. Lütfen destekle iletişime geçin.'},
                status=409,
            )
        user = verified
    else:
        user = matches.first()
    if not user:
        return Response({'error': 'Bu telefon numarası kayıtlı değil'}, status=404)
    if not user.sms_otp or user.sms_otp != code:
        return Response({'error': 'Doğrulama kodu hatalı'}, status=401)
    if not user.sms_otp_expires_at or user.sms_otp_expires_at < timezone.now():
        return Response({'error': 'Doğrulama kodu süresi dolmuş, yeniden gönderin'}, status=401)

    user.phone_verified = True
    user.sms_otp = None
    user.sms_otp_expires_at = None
    user.generate_session_token()
    user.save(update_fields=['phone_verified', 'sms_otp', 'sms_otp_expires_at', 'session_token'])

    tokens = get_jwt_tokens(user)
    return Response({
        'success': True, 'token': user.session_token,
        'access': tokens['access'], 'refresh': tokens['refresh'],
        'user': format_user(user),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def phone_link(request):
    phone = (request.data.get('phone') or '').strip()
    if not PHONE_RE.match(phone):
        return Response({'error': 'Geçerli bir telefon numarası girin'}, status=400)

    # Prevent linking a phone that another user has already verified.
    if User.objects.filter(phone=phone, phone_verified=True).exclude(id=request.user.id).exists():
        return Response({'error': 'Bu telefon numarası başka bir hesaba kayıtlı'}, status=409)

    otp = _generate_otp()
    user = request.user
    user.phone = phone
    user.sms_otp = otp
    user.sms_otp_expires_at = timezone.now() + timedelta(minutes=10)
    user.phone_verified = False
    user.save(update_fields=['phone', 'sms_otp', 'sms_otp_expires_at', 'phone_verified'])

    out = {'success': True, 'message': f'Doğrulama kodu {phone} numarasına gönderildi.'}
    if _is_dev():
        out['dev_otp'] = otp
    return Response(out)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def phone_confirm(request):
    code = (request.data.get('code') or '').strip()
    if not code:
        return Response({'error': 'Kod zorunludur'}, status=400)
    user = request.user
    if not user.sms_otp or user.sms_otp != code:
        return Response({'error': 'Doğrulama kodu hatalı'}, status=401)
    if not user.sms_otp_expires_at or user.sms_otp_expires_at < timezone.now():
        return Response({'error': 'Kod süresi dolmuş'}, status=401)
    user.phone_verified = True
    user.sms_otp = None
    user.sms_otp_expires_at = None
    user.save(update_fields=['phone_verified', 'sms_otp', 'sms_otp_expires_at'])
    return Response({'success': True})


# ─── Google OAuth ─────────────────────────────────────────────────────────────

def _frontend_base(request):
    return f"{request.scheme}://{request.get_host()}"


@api_view(['GET'])
@permission_classes([AllowAny])
def google_login(request):
    client_id = os.getenv('GOOGLE_CLIENT_ID')
    if not client_id:
        return Response(
            {'error': 'Google OAuth yapılandırılmamış. GOOGLE_CLIENT_ID gerekli.'},
            status=503,
        )
    # CSRF-protection: random state stored in the session, validated on callback.
    state = secrets.token_urlsafe(24)
    request.session['google_oauth_state'] = state
    request.session.save()
    redirect_uri = f"{_frontend_base(request)}/api/auth/google/callback"
    params = urllib.parse.urlencode({
        'client_id': client_id,
        'redirect_uri': redirect_uri,
        'response_type': 'code',
        'scope': 'openid email profile',
        'access_type': 'offline',
        'prompt': 'select_account',
        'state': state,
    })
    return HttpResponseRedirect(f'https://accounts.google.com/o/oauth2/v2/auth?{params}')


@api_view(['GET'])
@permission_classes([AllowAny])
def google_callback(request):
    client_id = os.getenv('GOOGLE_CLIENT_ID')
    client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
    base = _frontend_base(request)
    if not client_id or not client_secret:
        return HttpResponseRedirect(f'{base}/login?error=google_not_configured')

    expected_state = request.session.pop('google_oauth_state', None)
    received_state = request.GET.get('state')
    if not expected_state or expected_state != received_state:
        return HttpResponseRedirect(f'{base}/login?error=google_state_mismatch')

    code = request.GET.get('code')
    if not code:
        return HttpResponseRedirect(f'{base}/login?error=google_cancelled')

    try:
        redirect_uri = f"{base}/api/auth/google/callback"
        # Exchange code for tokens
        token_req = urllib.request.Request(
            'https://oauth2.googleapis.com/token',
            data=urllib.parse.urlencode({
                'code': code, 'client_id': client_id,
                'client_secret': client_secret, 'redirect_uri': redirect_uri,
                'grant_type': 'authorization_code',
            }).encode(),
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
        )
        with urllib.request.urlopen(token_req, timeout=10) as r:
            token_data = json.loads(r.read().decode())
        access_token = token_data.get('access_token')
        if not access_token:
            return HttpResponseRedirect(f'{base}/login?error=google_token_failed')

        info_req = urllib.request.Request(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
        )
        with urllib.request.urlopen(info_req, timeout=10) as r:
            google_user = json.loads(r.read().decode())
        if not google_user.get('sub'):
            return HttpResponseRedirect(f'{base}/login?error=google_userinfo_failed')

        email = google_user.get('email', '')
        sub = google_user['sub']
        user = User.objects.filter(google_id=sub).first() or User.objects.filter(email=email).first()
        if not user:
            base_username = re.sub(r'[^a-zA-Z0-9_]', '', email.split('@')[0]) or 'user'
            username = base_username
            i = 0
            while User.objects.filter(username=username).exists():
                i += 1
                username = f'{base_username}{i}'
            user = User(
                username=username, email=email, password_hash='',
                display_name=google_user.get('name') or username,
                avatar_url=google_user.get('picture'),
                google_id=sub,
                is_verified=bool(google_user.get('email_verified')),
            )
            user.set_unusable_password()
        elif not user.google_id:
            user.google_id = sub
            if not user.avatar_url:
                user.avatar_url = google_user.get('picture')
        user.generate_session_token()
        user.save()
        from django.conf import settings as _settings
        resp = HttpResponseRedirect(f'{base}/login?google=ok')
        resp.set_cookie(
            'google_session_token',
            user.session_token,
            max_age=300,
            httponly=True,
            secure=not getattr(_settings, 'DEBUG', False),
            samesite='Lax',
            path='/',
        )
        return resp
    except Exception:
        return HttpResponseRedirect(f'{base}/login?error=google_error')


@api_view(['POST'])
@permission_classes([AllowAny])
def google_exchange(request):
    """Exchange the HttpOnly google_session_token cookie for a JSON token payload.
    Clears the cookie after one-shot read so it cannot be replayed."""
    token = request.COOKIES.get('google_session_token')
    if not token:
        return Response({'detail': 'no_token'}, status=400)
    user = User.objects.filter(session_token=token).first()
    if not user:
        resp = Response({'detail': 'invalid_token'}, status=400)
        resp.delete_cookie('google_session_token', path='/')
        return resp
    resp = Response({
        'token': user.session_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'displayName': getattr(user, 'display_name', '') or user.username,
            'avatarUrl': getattr(user, 'avatar_url', None),
        },
    })
    resp.delete_cookie('google_session_token', path='/')
    return resp
