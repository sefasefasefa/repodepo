from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from .models import Video, VideoSubtitle
from .utils import resolve_video as _resolve_video


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
@permission_classes([AllowAny])
def get_subtitle_lang(request, video_id, lang):
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Altyazı bulunamadı'}, status=404)
    try:
        sub = VideoSubtitle.objects.get(video_id=video.id, language=lang)
    except VideoSubtitle.DoesNotExist:
        return Response({'error': 'Altyazı bulunamadı'}, status=404)
    return HttpResponse(sub.vtt_content, content_type='text/vtt; charset=utf-8')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_transcript(request, video_id):
    video = _resolve_video(video_id)
    if not video:
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
        video_id=video.id, language=lang,
        defaults={
            'label': lang_name or SUPPORTED_LANGUAGES.get(lang, lang),
            'vtt_content': content,
            'is_auto_generated': False,
        },
    )
    return Response({'id': sub.id, 'language': sub.language, 'status': 'ready'}, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_subtitle(request, video_id, lang):
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if not _can_edit(request.user, video):
        return Response({'error': 'Yetkisiz'}, status=403)
    try:
        sub = VideoSubtitle.objects.get(video_id=video.id, language=lang)
    except VideoSubtitle.DoesNotExist:
        return Response({'error': 'Altyazı bulunamadı'}, status=404)
    return Response({'id': sub.id, 'status': 'ready'})


def _ai_stub(request, video_id, action='generate'):
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if not _can_edit(request.user, video):
        return Response({'error': 'Yetkisiz'}, status=403)
    d = request.data or {}
    lang = d.get('language', 'tr')
    placeholder = 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\n[AI altyazı üretimi kuyruğa alındı]\n'
    sub, _ = VideoSubtitle.objects.update_or_create(
        video_id=video.id, language=lang,
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
@permission_classes([IsAuthenticated])
def generate_subtitle(request, video_id):
    return _ai_stub(request, video_id, 'generate')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def translate_subtitle(request, video_id):
    return _ai_stub(request, video_id, 'translate')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def auto_subtitle(request, video_id):
    return _ai_stub(request, video_id, 'auto')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ai_write_transcript(request, video_id):
    """AI writing assistant: takes notes/prompt and returns structured transcript text."""
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if not _can_edit(request.user, video):
        return Response({'error': 'Yetkisiz'}, status=403)
    d = request.data or {}
    notes = (d.get('notes') or '').strip()
    template = d.get('template', 'general')
    if not notes:
        return Response({'error': 'Notlar boş olamaz'}, status=400)

    # Template-based formatter (AI provider can be swapped in later)
    intros = {
        'tutorial': 'Bu videoda size adım adım nasıl yapılacağını göstereceğiz.',
        'review': 'Bu videoda ürünü / konuyu detaylıca inceleyeceğiz.',
        'story': 'Şimdi size ilginç bir hikaye anlatacağım.',
        'presentation': 'Bugünkü sunumumuza hoş geldiniz.',
        'news': 'Son dakika gelişmeleri hakkında bilgi veriyoruz.',
        'general': 'Bu videoya hoş geldiniz.',
    }
    intro = intros.get(template, intros['general'])
    paragraphs = [p.strip() for p in notes.replace('\r\n', '\n').split('\n\n') if p.strip()]
    if not paragraphs:
        paragraphs = [notes]
    result_lines = [intro, '']
    for i, para in enumerate(paragraphs):
        result_lines.append(para)
        if i < len(paragraphs) - 1:
            result_lines.append('')
    result_lines += ['', 'İzlediğiniz için teşekkürler.']
    return Response({'transcript': '\n'.join(result_lines)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_pending_subtitles(request, video_id):
    """List community-submitted (pending) subtitle tracks for creator review."""
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if not _can_edit(request.user, video):
        return Response({'error': 'Yetkisiz'}, status=403)
    subs = VideoSubtitle.objects.filter(video_id=video.id, moderation_status='pending')
    return Response({'pending': [
        {'language': s.language, 'langName': s.label, 'preview': s.vtt_content[:200]} for s in subs
    ]})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def community_submit(request, video_id):
    """Regular users submit a transcript suggestion for creator approval."""
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video bulunamadı'}, status=404)
    d = request.data or {}
    lang = d.get('language', 'tr')
    content = (d.get('content') or '').strip()
    if not content:
        return Response({'error': 'İçerik boş olamaz'}, status=400)
    if 'WEBVTT' not in content:
        content = 'WEBVTT\n\n' + content
    sub, created = VideoSubtitle.objects.get_or_create(
        video_id=video.id, language=f'{lang}_pending_{request.user.id}',
        defaults={
            'label': f'{SUPPORTED_LANGUAGES.get(lang, lang)} (Topluluk)',
            'vtt_content': content,
            'is_auto_generated': False,
            'moderation_status': 'pending',
        }
    )
    if not created:
        sub.vtt_content = content
        sub.moderation_status = 'pending'
        sub.save()
    return Response({'ok': True, 'message': 'Katkınız incelemeye alındı.'}, status=201)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_subtitle(request, video_id, lang):
    video = _resolve_video(video_id)
    if not video:
        return Response({'error': 'Video bulunamadı'}, status=404)
    if not _can_edit(request.user, video):
        return Response({'error': 'Yetkisiz'}, status=403)
    VideoSubtitle.objects.filter(video_id=video.id, language=lang).delete()
    return Response({'ok': True})
