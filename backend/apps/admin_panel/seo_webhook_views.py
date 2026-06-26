import os
import uuid
from rest_framework.decorators import api_view, permission_classes, authentication_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings
from .models import SeoSettings, WebhookSettings


def _is_admin(user):
    return user.is_authenticated and user.role in ('admin', 'moderator')


def _seo_to_dict(s):
    return {
        'siteTitle': s.site_title,
        'siteDescription': s.site_description,
        'keywords': s.keywords,
        'robots': s.robots,
        'ogImage': s.og_image,
        'ogTitle': s.og_title,
        'ogDescription': s.og_description,
        'ogType': s.og_type,
        'twitterCard': s.twitter_card,
        'twitterSite': s.twitter_site,
        'twitterCreator': s.twitter_creator,
        'canonicalUrl': s.canonical_url,
        'googleAnalyticsId': s.google_analytics_id,
        'googleSearchConsole': s.google_search_console,
        'structuredDataEnabled': s.structured_data_enabled,
        'sitemapEnabled': s.sitemap_enabled,
        'hreflang': s.hreflang,
        'schemaOrgType': s.schema_org_type,
    }


@api_view(['GET', 'PUT'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def seo_settings(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    s, _ = SeoSettings.objects.get_or_create(id=1)
    if request.method == 'PUT':
        d = request.data
        s.site_title = d.get('siteTitle', s.site_title)
        s.site_description = d.get('siteDescription', s.site_description)
        s.keywords = d.get('keywords', s.keywords)
        s.robots = d.get('robots', s.robots)
        s.og_image = d.get('ogImage', s.og_image)
        s.og_title = d.get('ogTitle', s.og_title)
        s.og_description = d.get('ogDescription', s.og_description)
        s.og_type = d.get('ogType', s.og_type)
        s.twitter_card = d.get('twitterCard', s.twitter_card)
        s.twitter_site = d.get('twitterSite', s.twitter_site)
        s.twitter_creator = d.get('twitterCreator', s.twitter_creator)
        s.canonical_url = d.get('canonicalUrl', s.canonical_url)
        s.google_analytics_id = d.get('googleAnalyticsId', s.google_analytics_id)
        s.google_search_console = d.get('googleSearchConsole', s.google_search_console)
        if 'structuredDataEnabled' in d:
            s.structured_data_enabled = bool(d['structuredDataEnabled'])
        if 'sitemapEnabled' in d:
            s.sitemap_enabled = bool(d['sitemapEnabled'])
        s.hreflang = d.get('hreflang', s.hreflang)
        s.schema_org_type = d.get('schemaOrgType', s.schema_org_type)
        s.save()
    return Response({'settings': _seo_to_dict(s)})


@api_view(['GET'])
@permission_classes([AllowAny])
def public_seo_settings(request):
    s, _ = SeoSettings.objects.get_or_create(id=1)
    return Response(_seo_to_dict(s))


WEBHOOK_PLATFORMS = {
    'discord': {'name': 'Discord', 'color': '#5865F2', 'placeholder': 'https://discord.com/api/webhooks/...'},
    'slack': {'name': 'Slack', 'color': '#4A154B', 'placeholder': 'https://hooks.slack.com/services/...'},
    'zapier': {'name': 'Zapier', 'color': '#FF4A00', 'placeholder': 'https://hooks.zapier.com/hooks/catch/...'},
    'make': {'name': 'Make (Integromat)', 'color': '#7E3AF2', 'placeholder': 'https://hook.make.com/...'},
    'n8n': {'name': 'n8n', 'color': '#EA4B71', 'placeholder': 'https://your-n8n.com/webhook/...'},
    'ifttt': {'name': 'IFTTT', 'color': '#009AE5', 'placeholder': 'https://maker.ifttt.com/trigger/.../with/key/...'},
    'pipedream': {'name': 'Pipedream', 'color': '#3CC877', 'placeholder': 'https://eo.pipedream.net/...'},
    'teams': {'name': 'Microsoft Teams', 'color': '#6264A7', 'placeholder': 'https://...webhook.office.com/...'},
    'telegram': {'name': 'Telegram Bot', 'color': '#2AABEE', 'placeholder': 'https://api.telegram.org/bot.../sendMessage'},
    'custom': {'name': 'Özel HTTP', 'color': '#6B7280', 'placeholder': 'https://example.com/webhook'},
}

ALL_EVENTS = [
    'video.created', 'video.updated', 'video.deleted', 'video.published',
    'video.approved', 'video.rejected',
    'user.registered', 'user.banned', 'user.role_changed',
    'payment.completed', 'payment.failed', 'subscription.created', 'subscription.cancelled',
    'creator.approved', 'creator.rejected',
    'comment.created', 'report.created',
    'live.started', 'live.ended',
]


@api_view(['GET', 'PUT'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def webhook_settings(request):
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    s, _ = WebhookSettings.objects.get_or_create(id=1)
    if request.method == 'PUT':
        d = request.data
        s.is_enabled = d.get('isEnabled', s.is_enabled)
        s.endpoint_url = d.get('endpointUrl', s.endpoint_url)
        s.secret = d.get('secret', s.secret)
        if 'events' in d and isinstance(d['events'], list):
            s.events = d['events']
        if 'endpoints' in d and isinstance(d['endpoints'], list):
            s.endpoints = d['endpoints']
        s.save()
    return Response({
        'settings': {
            'isEnabled': s.is_enabled,
            'endpointUrl': s.endpoint_url,
            'secret': s.secret,
            'events': s.events or [],
            'endpoints': s.endpoints or [],
        },
        'platforms': WEBHOOK_PLATFORMS,
        'allEvents': ALL_EVENTS,
    })


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def watermark_upload(request):
    from apps.videos.models import WatermarkSettings
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    f = request.FILES.get('file')
    if not f:
        return Response({'error': 'Dosya gerekli'}, status=400)
    ext = os.path.splitext(f.name)[1].lower()
    if ext not in ['.png', '.svg', '.jpg', '.jpeg', '.gif', '.webp']:
        return Response({'error': 'Desteklenmeyen dosya türü'}, status=400)
    filename = f'watermark_{uuid.uuid4().hex}{ext}'
    upload_dir = os.path.join(settings.MEDIA_ROOT, 'watermarks')
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, 'wb') as dest:
        for chunk in f.chunks():
            dest.write(chunk)
    url = f'{settings.MEDIA_URL}watermarks/{filename}'
    s, _ = WatermarkSettings.objects.get_or_create(id=1)
    s.image_url = url
    s.save(update_fields=['image_url'])
    return Response({'url': url})


@api_view(['GET', 'PUT'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def watermark_admin_settings(request):
    from apps.videos.models import WatermarkSettings
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    s, _ = WatermarkSettings.objects.get_or_create(id=1)
    if request.method == 'PUT':
        d = request.data
        if 'isEnabled' in d:
            s.is_enabled = d['isEnabled']
        if 'imageUrl' in d:
            s.image_url = d['imageUrl'] or None
        if 'text' in d:
            s.text = d['text']
        if 'useImage' in d:
            s.use_image = d['useImage']
        if 'position' in d:
            s.position = d['position']
        if 'size' in d:
            s.size = d['size']
        if 'opacity' in d:
            try:
                s.opacity = float(d['opacity'])
            except (TypeError, ValueError):
                pass
        s.save()
    return Response({'settings': {
        'isEnabled': s.is_enabled,
        'imageUrl': s.image_url,
        'text': s.text,
        'useImage': s.use_image,
        'position': s.position,
        'size': s.size,
        'opacity': float(s.opacity) if s.opacity is not None else 0.5,
    }})
