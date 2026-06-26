"""
Webhook Dispatcher Service
==========================
Handles formatting, signing, sending, retry logic and delivery logging
for all registered webhook endpoints.

Platform-specific payload formatting:
  - Discord  → rich embed with color, fields, footer
  - Slack    → Block Kit (header + section + context)
  - Teams    → Adaptive Card (O365 connector card)
  - Telegram → Markdown message via Bot API sendMessage
  - Zapier / Make / n8n / Pipedream / IFTTT / Custom → generic JSON

Signing:
  - Custom endpoints: X-Webhook-Signature: sha256=<hmac>
  - Discord / Slack / Teams: no custom signing (platform manages this)
  - Telegram: no signing needed

Retry:
  - Up to max_retries attempts (default 3)
  - Exponential backoff: 5s, 25s, 125s
  - Non-2xx response OR network error = failure
"""

import hashlib
import hmac
import json
import time
import logging
from datetime import datetime, timezone as tz
from django.utils import timezone

logger = logging.getLogger(__name__)

# ── Event metadata registry ─────────────────────────────────────────────────
EVENT_META = {
    'video.created':           {'emoji': '🎬', 'color': 0x7c3aed, 'label': 'Yeni Video'},
    'video.updated':           {'emoji': '✏️',  'color': 0x2563eb, 'label': 'Video Güncellendi'},
    'video.deleted':           {'emoji': '🗑️',  'color': 0xef4444, 'label': 'Video Silindi'},
    'video.published':         {'emoji': '✅',  'color': 0x22c55e, 'label': 'Video Yayınlandı'},
    'video.approved':          {'emoji': '✅',  'color': 0x22c55e, 'label': 'Video Onaylandı'},
    'video.rejected':          {'emoji': '❌',  'color': 0xef4444, 'label': 'Video Reddedildi'},
    'user.registered':         {'emoji': '👤',  'color': 0x06b6d4, 'label': 'Yeni Kullanıcı'},
    'user.banned':             {'emoji': '🚫',  'color': 0xef4444, 'label': 'Kullanıcı Banlandı'},
    'user.role_changed':       {'emoji': '🔑',  'color': 0xf59e0b, 'label': 'Rol Değişti'},
    'payment.completed':       {'emoji': '💳',  'color': 0x22c55e, 'label': 'Ödeme Tamamlandı'},
    'payment.failed':          {'emoji': '❗',  'color': 0xef4444, 'label': 'Ödeme Başarısız'},
    'subscription.created':    {'emoji': '🌟',  'color': 0x7c3aed, 'label': 'Yeni Abonelik'},
    'subscription.cancelled':  {'emoji': '↩️',  'color': 0xf59e0b, 'label': 'Abonelik İptal'},
    'subscription.expired':    {'emoji': '⏰',  'color': 0x6b7280, 'label': 'Abonelik Süresi Doldu'},
    'creator.approved':        {'emoji': '🎉',  'color': 0x22c55e, 'label': 'Creator Onaylandı'},
    'creator.rejected':        {'emoji': '❌',  'color': 0xef4444, 'label': 'Creator Reddedildi'},
    'comment.created':         {'emoji': '💬',  'color': 0x3b82f6, 'label': 'Yeni Yorum'},
    'report.created':          {'emoji': '⚠️',  'color': 0xf59e0b, 'label': 'Yeni Şikayet'},
    'live.started':            {'emoji': '🔴',  'color': 0xef4444, 'label': 'Canlı Yayın Başladı'},
    'live.ended':              {'emoji': '⬛',  'color': 0x6b7280, 'label': 'Canlı Yayın Bitti'},
    'tip.received':            {'emoji': '💎',  'color': 0x06b6d4, 'label': 'Token Gönderildi'},
}


def _now_iso():
    return timezone.now().isoformat()


def _hmac_signature(secret: str, body: str) -> str:
    """HMAC-SHA256 signature for custom endpoints."""
    return 'sha256=' + hmac.new(
        secret.encode(), body.encode(), hashlib.sha256
    ).hexdigest()


# ── Platform-specific payload formatters ─────────────────────────────────────

def _format_discord(event: str, payload: dict) -> dict:
    """Discord Webhook — rich embed."""
    meta = EVENT_META.get(event, {'emoji': '📡', 'color': 0x6b7280, 'label': event})
    fields = []
    for k, v in payload.items():
        if k in ('event', 'timestamp') or v is None:
            continue
        fields.append({'name': str(k).replace('_', ' ').title(), 'value': str(v)[:1024], 'inline': True})
    return {
        'username': 'Prnhbbbb Webhooks',
        'avatar_url': 'https://cdn.discordapp.com/embed/avatars/0.png',
        'embeds': [{
            'title': f'{meta["emoji"]} {meta["label"]}',
            'color': meta['color'],
            'fields': fields[:25],
            'footer': {'text': f'Prnhbbbb Platform • {payload.get("timestamp", _now_iso())}'},
            'timestamp': payload.get('timestamp', _now_iso()),
        }],
    }


def _format_slack(event: str, payload: dict) -> dict:
    """Slack Webhook — Block Kit layout."""
    meta = EVENT_META.get(event, {'emoji': '📡', 'color': '#6b7280', 'label': event})
    color_hex = f'#{meta["color"]:06x}' if isinstance(meta['color'], int) else meta['color']
    text_lines = [f'*{k.replace("_", " ").title()}:* {v}' for k, v in payload.items() if k not in ('event', 'timestamp') and v is not None]
    return {
        'attachments': [{
            'color': color_hex,
            'blocks': [
                {
                    'type': 'header',
                    'text': {'type': 'plain_text', 'text': f'{meta["emoji"]} {meta["label"]}', 'emoji': True},
                },
                {
                    'type': 'section',
                    'text': {'type': 'mrkdwn', 'text': '\n'.join(text_lines[:20]) or '_Veri yok_'},
                },
                {
                    'type': 'context',
                    'elements': [{'type': 'mrkdwn', 'text': f'🕐 {payload.get("timestamp", _now_iso())} • Prnhbbbb Platform'}],
                },
            ],
        }],
    }


def _format_teams(event: str, payload: dict) -> dict:
    """Microsoft Teams — O365 Connector Card."""
    meta = EVENT_META.get(event, {'emoji': '📡', 'color': '#6b7280', 'label': event})
    color_hex = f'{meta["color"]:06x}' if isinstance(meta['color'], int) else meta['color'].lstrip('#')
    facts = [{'name': k.replace('_', ' ').title(), 'value': str(v)} for k, v in payload.items() if k not in ('event', 'timestamp') and v is not None]
    return {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        'themeColor': color_hex,
        'summary': f'{meta["emoji"]} {meta["label"]}',
        'sections': [{
            'activityTitle': f'**{meta["emoji"]} {meta["label"]}**',
            'activitySubtitle': f'Prnhbbbb Platform — {payload.get("timestamp", _now_iso())}',
            'facts': facts[:15],
            'markdown': True,
        }],
    }


def _format_telegram(event: str, payload: dict, chat_id: str = None) -> dict:
    """Telegram Bot API — sendMessage with Markdown."""
    meta = EVENT_META.get(event, {'emoji': '📡', 'label': event})
    lines = [f'*{meta["emoji"]} {meta["label"]}*', '']
    for k, v in payload.items():
        if k in ('event', 'timestamp') or v is None:
            continue
        lines.append(f'• *{k.replace("_", " ").title()}:* {v}')
    lines += ['', f'🕐 {payload.get("timestamp", _now_iso())}']
    return {
        'chat_id': chat_id or '@prnhbbbb',
        'text': '\n'.join(lines),
        'parse_mode': 'Markdown',
        'disable_web_page_preview': True,
    }


def _format_generic(event: str, payload: dict) -> dict:
    """Generic JSON for Zapier / Make / n8n / Pipedream / IFTTT / Custom."""
    meta = EVENT_META.get(event, {'emoji': '📡', 'label': event})
    return {
        'event': event,
        'event_label': meta['label'],
        'event_emoji': meta['emoji'],
        'timestamp': payload.get('timestamp', _now_iso()),
        'platform': 'Prnhbbbb',
        'data': {k: v for k, v in payload.items() if k != 'timestamp'},
    }


def build_request(endpoint_obj, event: str, payload: dict) -> tuple[str, dict, str]:
    """
    Returns (url, headers, body_str) ready to send.
    Applies platform-specific formatting and signing.
    """
    platform = endpoint_obj.platform

    if platform == 'discord':
        body_data = _format_discord(event, payload)
    elif platform == 'slack':
        body_data = _format_slack(event, payload)
    elif platform == 'teams':
        body_data = _format_teams(event, payload)
    elif platform == 'telegram':
        # Telegram URL already includes /sendMessage; chat_id may be in url param
        body_data = _format_telegram(event, payload)
    else:
        body_data = _format_generic(event, payload)

    body_str = json.dumps(body_data, ensure_ascii=False, default=str)
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Prnhbbbb-Webhooks/2.0',
        'X-Webhook-Event': event,
        'X-Webhook-Platform': platform,
        'X-Webhook-Timestamp': _now_iso(),
    }

    if endpoint_obj.secret and platform in ('custom', 'n8n', 'pipedream', 'zapier', 'make', 'ifttt'):
        headers['X-Webhook-Signature'] = _hmac_signature(endpoint_obj.secret, body_str)

    return endpoint_obj.url, headers, body_str


# ── Core dispatcher ────────────────────────────────────────────────────────────

def dispatch(endpoint_obj, event: str, payload: dict, delivery_obj=None):
    """
    Send one webhook delivery. Creates/updates a WebhookDelivery record.
    Returns the delivery object.
    """
    import urllib.request
    import urllib.error
    from .models import WebhookDelivery

    url, headers, body_str = build_request(endpoint_obj, event, payload)

    if delivery_obj is None:
        delivery_obj = WebhookDelivery.objects.create(
            endpoint=endpoint_obj,
            event=event,
            payload=payload,
            request_body=body_str,
            request_headers=headers,
            status='pending',
            max_attempts=endpoint_obj.max_retries,
        )

    backoff_seconds = [0, 5, 25, 125]  # attempt 1 = no wait, 2 = 5s, 3 = 25s

    for attempt in range(1, endpoint_obj.max_retries + 1):
        if attempt > 1:
            wait = backoff_seconds[min(attempt - 1, len(backoff_seconds) - 1)]
            time.sleep(wait)
            delivery_obj.attempt = attempt
            delivery_obj.status = 'retrying'
            delivery_obj.save(update_fields=['attempt', 'status'])

        t0 = time.time()
        try:
            req = urllib.request.Request(
                url,
                data=body_str.encode('utf-8'),
                headers=headers,
                method='POST',
            )
            with urllib.request.urlopen(req, timeout=endpoint_obj.timeout_secs) as resp:
                elapsed_ms = int((time.time() - t0) * 1000)
                resp_body = resp.read().decode('utf-8', errors='replace')[:4096]
                status_code = resp.status

        except urllib.error.HTTPError as e:
            elapsed_ms = int((time.time() - t0) * 1000)
            status_code = e.code
            resp_body = e.read().decode('utf-8', errors='replace')[:4096] if e.fp else ''
        except Exception as exc:
            elapsed_ms = int((time.time() - t0) * 1000)
            status_code = None
            resp_body = ''
            delivery_obj.error = str(exc)[:2000]
            if attempt >= endpoint_obj.max_retries:
                delivery_obj.status = 'failed'
                delivery_obj.response_time_ms = elapsed_ms
                delivery_obj.save(update_fields=['status', 'error', 'attempt', 'response_time_ms'])
                _update_endpoint_stats(endpoint_obj, success=False, status_code=None)
            continue

        delivery_obj.response_status = status_code
        delivery_obj.response_body = resp_body
        delivery_obj.response_time_ms = elapsed_ms
        delivery_obj.delivered_at = timezone.now()

        if 200 <= status_code < 300:
            delivery_obj.status = 'success'
            delivery_obj.save(update_fields=['status', 'response_status', 'response_body', 'response_time_ms', 'delivered_at', 'attempt'])
            _update_endpoint_stats(endpoint_obj, success=True, status_code=status_code)
            return delivery_obj

        # Non-2xx — may retry
        if attempt >= endpoint_obj.max_retries:
            delivery_obj.status = 'failed'
            delivery_obj.save(update_fields=['status', 'response_status', 'response_body', 'response_time_ms', 'delivered_at', 'attempt', 'error'])
            _update_endpoint_stats(endpoint_obj, success=False, status_code=status_code)
            return delivery_obj

    return delivery_obj


def _update_endpoint_stats(endpoint_obj, success: bool, status_code):
    """Update denormalized stats and health status on the endpoint."""
    from .models import WebhookEndpoint
    WebhookEndpoint.objects.filter(pk=endpoint_obj.pk).update(
        total_deliveries=models_F('total_deliveries') + 1,
        success_deliveries=models_F('success_deliveries') + (1 if success else 0),
        last_triggered_at=timezone.now(),
        last_status_code=status_code,
        status='active' if success else 'failing',
    )


def models_F(field):
    """Lazy import of Django F() to avoid circular imports."""
    from django.db.models import F
    return F(field)


# ── Public API ────────────────────────────────────────────────────────────────

def fire_event(event: str, payload: dict):
    """
    Fire an event to all enabled endpoints subscribed to it.
    Runs synchronously (call from a thread if you want async).
    """
    from .models import WebhookEndpoint

    # Global kill-switch via legacy WebhookSettings
    from .models import WebhookSettings
    try:
        settings_row = WebhookSettings.objects.get(id=1)
        if not settings_row.is_enabled:
            return
    except WebhookSettings.DoesNotExist:
        pass

    payload.setdefault('timestamp', _now_iso())
    payload.setdefault('event', event)

    endpoints = WebhookEndpoint.objects.filter(is_enabled=True)
    for ep in endpoints:
        subscribed = ep.events  # list of event strings; empty = all events
        if subscribed and event not in subscribed:
            continue
        try:
            dispatch(ep, event, payload)
        except Exception as exc:
            logger.error('Webhook dispatch error for endpoint %s: %s', ep.id, exc, exc_info=True)


def fire_event_async(event: str, payload: dict):
    """Non-blocking version — spawns a daemon thread."""
    import threading
    t = threading.Thread(target=fire_event, args=(event, payload), daemon=True)
    t.start()
