"""Şüpheli/reddedilen istekleri (403/404) veritabanına kaydeden middleware.

İnternet genelinde her açık sunucuya gelen bot/tarayıcı trafiğini (GraphQL
playground taramaları, exploit kit'leri, IoT tarayıcıları vb.) admin
panelindeki Güvenlik sekmesinde görünür kılmak için kullanılır.
"""
import random

IGNORED_PREFIXES = ('/static/', '/media/', '/assets/', '/admin/jsi18n/')
LOGGED_STATUS_CODES = (403, 404)
CLEANUP_RETENTION_DAYS = 14
CLEANUP_PROBABILITY = 0.01


def _client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '') or '0.0.0.0'


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
