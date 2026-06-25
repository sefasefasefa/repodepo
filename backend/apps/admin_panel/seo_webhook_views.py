from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import SeoSettings, WebhookSettings


def _is_admin(user):
    return user.is_authenticated and user.role in ('admin', 'moderator')


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
        s.save()
    return Response({'settings': {
        'siteTitle': s.site_title, 'siteDescription': s.site_description,
        'keywords': s.keywords, 'robots': s.robots, 'ogImage': s.og_image,
    }})


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
        s.save()
    return Response({'settings': {
        'isEnabled': s.is_enabled, 'endpointUrl': s.endpoint_url,
        'secret': s.secret, 'events': s.events or [],
    }})


@api_view(['GET', 'PUT'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def watermark_admin_settings(request):
    """Alias for FE call /api/watermark/admin/settings — returns {settings:{...}} shape."""
    from apps.videos.models import WatermarkSettings
    if not _is_admin(request.user):
        return Response({'error': 'Admin gerekli'}, status=403)
    s, _ = WatermarkSettings.objects.get_or_create(id=1)
    if request.method == 'PUT':
        d = request.data
        if 'isEnabled' in d: s.is_enabled = d['isEnabled']
        if 'imageUrl' in d: s.image_url = d['imageUrl'] or None
        if 'text' in d: s.text = d['text']
        if 'useImage' in d: s.use_image = d['useImage']
        if 'position' in d: s.position = d['position']
        if 'size' in d: s.size = d['size']
        if 'opacity' in d:
            try: s.opacity = float(d['opacity'])
            except (TypeError, ValueError): pass
        s.save()
    return Response({'settings': {
        'isEnabled': s.is_enabled, 'imageUrl': s.image_url, 'text': s.text,
        'useImage': s.use_image, 'position': s.position, 'size': s.size,
        'opacity': float(s.opacity) if s.opacity is not None else 0.5,
    }})
