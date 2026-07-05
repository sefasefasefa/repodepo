"""Şüpheli/reddedilen istekleri (403/404) veritabanına kaydeden ve admin
panelinden engellenen IP'leri reddeden middleware'ler.

İnternet genelinde her açık sunucuya gelen bot/tarayıcı trafiğini (GraphQL
playground taramaları, exploit kit'leri, IoT tarayıcıları vb.) admin
panelindeki Güvenlik sekmesinde görünür kılmak için kullanılır.
"""
import random

from django.core.cache import cache
from django.http import JsonResponse

IGNORED_PREFIXES = ('/static/', '/media/', '/assets/', '/admin/jsi18n/')
LOGGED_STATUS_CODES = (403, 404)
CLEANUP_RETENTION_DAYS = 14
CLEANUP_PROBABILITY = 0.01
BLOCKED_IPS_CACHE_KEY = 'security:blocked_ips'
BLOCKED_IPS_CACHE_TTL = 30  # saniye — engel listesi değişince en geç bu sürede yayılır


def _client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '') or '0.0.0.0'


def invalidate_blocked_ips_cache():
    cache.delete(BLOCKED_IPS_CACHE_KEY)


class IPBlockMiddleware:
    """Admin panelinden engellenen IP'lerden gelen tüm istekleri 403 ile reddeder."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        ip = _client_ip(request)
        blocked_ips = cache.get(BLOCKED_IPS_CACHE_KEY)
        if blocked_ips is None:
            from apps.admin_panel.models import BlockedIP
            blocked_ips = set(BlockedIP.objects.values_list('ip_address', flat=True))
            cache.set(BLOCKED_IPS_CACHE_KEY, blocked_ips, BLOCKED_IPS_CACHE_TTL)

        if ip in blocked_ips:
            return JsonResponse({'error': 'IP adresiniz engellenmiştir.'}, status=403)

        return self.get_response(request)


class SuspiciousAccessLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            if response.status_code in LOGGED_STATUS_CODES and not request.path.startswith(IGNORED_PREFIXES):
                self._log(request, response)
        except Exception:
            # Loglama asla ana isteği bozmamalı.
            pass
        return response

    def _log(self, request, response):
        from apps.admin_panel.models import SecurityAccessLog

        SecurityAccessLog.objects.create(
            ip_address=_client_ip(request),
            path=request.path[:500],
            method=request.method,
            status_code=response.status_code,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
        )

        if random.random() < CLEANUP_PROBABILITY:
            from django.utils import timezone
            from datetime import timedelta

            SecurityAccessLog.objects.filter(
                created_at__lt=timezone.now() - timedelta(days=CLEANUP_RETENTION_DAYS)
            ).delete()
