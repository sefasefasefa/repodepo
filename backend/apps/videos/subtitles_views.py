from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import Video, VideoSubtitle


SUPPORTED_LANGUAGES = {
    'tr': 'Türkçe', 'en': 'English', 'de': 'Deutsch', 'fr': 'Français',
    'es': 'Español', 'it': 'Italiano', 'pt': 'Português', 'ru': 'Русский',
    'ja': '日本語', 'ko': '한국어', 'zh': '中文', 'ar': 'العربية',
    'nl': 'Nederlands', 'pl': 'Polski', 'sv': 'Svenska', 'no': 'Norsk',
    'da': 'Dansk', 'fi': 'Suomi', 'el': 'Ελληνικά', 'ro': 'Română',
}


def _can_edit(user, video):
    return user.is_authenticated and (video.creator_id == user.id or getattr(user, 'role', '') == 'admin')


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([AllowAny])
def get_subtitle_lang(request, video_id, lang):
    try:
        sub = VideoSubtitle.objects.get(video_id=video_id, language=lang)
    except VideoSubtitle.DoesNotExist:
        return Response({'error': 'Altyazı bulunamadı'}, status=404)
    return HttpResponse(sub.vtt_content, content_type='text/vtt; charset=utf-8')


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def upload_transcript(request, video_id):
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if not _can_edit(request.user, video):
        return Response({'error': 'Yetkisiz'}, status=403)
    d = request.data or {}
    lang, content, lang_name = d.get('language'), d.get('content'), d.get('langName')
    if not lang or not content:
        return Response({'error': 'language ve content zorunlu'}, status=400)
    if 'WEBVTT' not in content:
        return Response({'error': 'Geçersiz VTT formatı'}, status=400)
    sub, _ = VideoSubtitle.objects.update_or_create(
        video_id=video_id, language=lang,
        defaults={
            'label': lang_name or SUPPORTED_LANGUAGES.get(lang, lang),
            'vtt_content': content,
            'is_auto_generated': False,
        },
    )
    return Response({'id': sub.id, 'language': sub.language, 'status': 'ready'}, status=201)


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def approve_subtitle(request, video_id, lang):
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if not _can_edit(request.user, video):
        return Response({'error': 'Yetkisiz'}, status=403)
    try:
        sub = VideoSubtitle.objects.get(video_id=video_id, language=lang)
    except VideoSubtitle.DoesNotExist:
        return Response({'error': 'Altyazı bulunamadı'}, status=404)
    return Response({'id': sub.id, 'status': 'ready'})


def _ai_stub(request, video_id, action='generate'):
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if not _can_edit(request.user, video):
        return Response({'error': 'Yetkisiz'}, status=403)
    d = request.data or {}
    lang = d.get('language', 'tr')
    placeholder = 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n[AI altyazı üretimi kuyruğa alındı]\n'
    sub, _ = VideoSubtitle.objects.update_or_create(
        video_id=video_id, language=lang,
        defaults={
            'label': SUPPORTED_LANGUAGES.get(lang, lang),
            'vtt_content': placeholder,
            'is_auto_generated': True,
        },
    )
    return Response({
        'id': sub.id, 'status': 'processing', 'action': action,
        'message': 'AI servisi yapılandırıldığında otomatik üretilecek.',
    }, status=202)


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def generate_subtitle(request, video_id):
    return _ai_stub(request, video_id, 'generate')


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def translate_subtitle(request, video_id):
    return _ai_stub(request, video_id, 'translate')


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def auto_subtitle(request, video_id):
    return _ai_stub(request, video_id, 'auto')


@api_view(['DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def delete_subtitle(request, video_id, lang):
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if not _can_edit(request.user, video):
        return Response({'error': 'Yetkisiz'}, status=403)
    VideoSubtitle.objects.filter(video_id=video_id, language=lang).delete()
    return Response({'ok': True})
