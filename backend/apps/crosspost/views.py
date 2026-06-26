from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import (api_view, authentication_classes,
                                       permission_classes)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.videos.models import Video

from .dispatcher import dispatch_for_video, test_login
from .models import CrossPostJob, CrossPostSite, PROVIDER_CATALOG


def _site_or_404(user, site_id):
    try:
        return CrossPostSite.objects.get(id=site_id, user=user)
    except CrossPostSite.DoesNotExist:
        return None


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def provider_catalog(request):
    """Tam sağlayıcı kataloğunu döner. Kullanıcının yapılandırdığı sitelerle eşleştirir."""
    user_sites = CrossPostSite.objects.filter(user=request.user).values(
        'id', 'provider_key', 'enabled', 'name'
    )
    configured = {s['provider_key']: s for s in user_sites}

    result = []
    for p in PROVIDER_CATALOG:
        entry = dict(p)
        site = configured.get(p['key'])
        if site:
            entry['siteId'] = site['id']
            entry['configured'] = True
            entry['enabled'] = site['enabled']
        else:
            entry['siteId'] = None
            entry['configured'] = False
            entry['enabled'] = False
        result.append(entry)
    return Response({'providers': result})


@api_view(['GET', 'POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def sites_list_create(request):
    if request.method == 'GET':
        qs = CrossPostSite.objects.filter(user=request.user)
        return Response({'sites': [s.to_dict() for s in qs]})

    d = request.data or {}
    if not d.get('name'):
        return Response({'error': 'name zorunlu'}, status=400)

    provider_key = d.get('providerKey', '') or ''
    catalog_entry = next((p for p in PROVIDER_CATALOG if p['key'] == provider_key), None)

    site = CrossPostSite.objects.create(
        user=request.user,
        name=d.get('name'),
        provider_key=provider_key,
        accepts_adult=catalog_entry['acceptsAdult'] if catalog_entry else bool(d.get('acceptsAdult', False)),
        provider_color=catalog_entry['color'] if catalog_entry else (d.get('providerColor', '') or ''),
        provider_letter=catalog_entry['letter'] if catalog_entry else (d.get('providerLetter', '') or ''),
        base_url=catalog_entry['baseUrl'] if catalog_entry else (d.get('baseUrl', '') or ''),
        upload_endpoint=d.get('uploadEndpoint', '') or '',
        login_endpoint=d.get('loginEndpoint', '') or '',
        adapter=d.get('adapter', 'generic_webhook'),
        username=d.get('username', '') or '',
        password=d.get('password', '') or '',
        api_key=d.get('apiKey', '') or '',
        extra_headers=d.get('extraHeaders') or {},
        enabled=bool(d.get('enabled', True)),
        auto_post=bool(d.get('autoPost', True)),
    )
    return Response({'site': site.to_dict()}, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def site_detail(request, site_id):
    site = _site_or_404(request.user, site_id)
    if not site:
        return Response({'error': 'Bulunamadi'}, status=404)

    if request.method == 'GET':
        return Response({'site': site.to_dict()})

    if request.method == 'DELETE':
        site.delete()
        return Response({'message': 'silindi'})

    d = request.data or {}
    field_map = {
        'name': 'name', 'baseUrl': 'base_url',
        'uploadEndpoint': 'upload_endpoint',
        'loginEndpoint': 'login_endpoint', 'adapter': 'adapter',
        'username': 'username',
        'extraHeaders': 'extra_headers', 'enabled': 'enabled',
        'autoPost': 'auto_post',
    }
    for k, attr in field_map.items():
        if k in d and d[k] is not None:
            setattr(site, attr, d[k])
    # Sirlar yalnizca dolu gonderilirse guncellenir
    if d.get('password'):
        site.password = d['password']
    if d.get('apiKey'):
        site.api_key = d['apiKey']
    site.save()
    return Response({'site': site.to_dict()})


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def site_test_login(request, site_id):
    site = _site_or_404(request.user, site_id)
    if not site:
        return Response({'error': 'Bulunamadi'}, status=404)
    ok, msg, code = test_login(site)
    site.last_login_ok = ok
    site.last_error = '' if ok else (msg or '')
    site.save(update_fields=['last_login_ok', 'last_error'])
    return Response({'ok': ok, 'message': msg, 'statusCode': code})


@api_view(['POST'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def dispatch(request):
    """Manuel olarak bir video icin cross-post tetikle."""
    d = request.data or {}
    video_id = d.get('videoId')
    if not video_id:
        return Response({'error': 'videoId zorunlu'}, status=400)
    try:
        video = Video.objects.get(id=video_id)
    except Video.DoesNotExist:
        return Response({'error': 'Video bulunamadi'}, status=404)
    if video.creator_id != request.user.id and request.user.role != 'admin':
        return Response({'error': 'yetkisiz'}, status=403)
    site_ids = d.get('siteIds')  # None -> auto_post sites
    jobs = dispatch_for_video(video, request.user, site_ids)
    return Response({'jobs': [j.to_dict() for j in jobs]}, status=201)


@api_view(['GET'])
@authentication_classes([JWTAuthentication])
@permission_classes([IsAuthenticated])
def jobs_list(request):
    qs = CrossPostJob.objects.filter(user=request.user).select_related('site')[:200]
    return Response({'jobs': [j.to_dict() for j in qs]})
