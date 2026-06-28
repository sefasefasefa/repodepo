"""
Server-side SEO: /videos/<slug> isteklerinde Django index.html'e
OG meta tagları + JSON-LD VideoObject enjekte eder.
Tüm istemciler (botlar dahil) zengin meta içerikli sayfa alır.
"""
import os
import json
from xml.sax.saxutils import escape as xml_escape
from django.conf import settings
from django.http import HttpResponse


def _read_index_html() -> str | None:
    candidates = list(settings.STATICFILES_DIRS) + [settings.STATIC_ROOT]
    for root in candidates:
        p = os.path.join(str(root), 'index.html')
        if os.path.exists(p):
            with open(p, 'r', encoding='utf-8') as f:
                return f.read()
    return None


def _site_base(request) -> str:
    url = getattr(settings, 'SITE_URL', '') or ''
    if url:
        return url.rstrip('/')
    return request.build_absolute_uri('/').rstrip('/')


def _seconds_to_iso8601(seconds: int | None) -> str | None:
    if not seconds or seconds <= 0:
        return None
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    iso = 'PT'
    if h:
        iso += f'{h}H'
    if m:
        iso += f'{m}M'
    if s or not (h or m):
        iso += f'{s}S'
    return iso


def _inject_into_head(html: str, content: str) -> str:
    """</head> öncesine içerik enjekte eder."""
    if '</head>' in html:
        return html.replace('</head>', content + '\n</head>', 1)
    return html


def video_seo_page(request, slug):
    """
    /videos/<slug> için server-side OG + JSON-LD enjeksiyonlu index.html.
    Video bulunamazsa normal index.html döner (SPA devralır).
    """
    html = _read_index_html()
    if not html:
        return HttpResponse(
            '<!DOCTYPE html><html><body><p>Build edilmemiş frontend.</p></body></html>',
            content_type='text/html',
            status=503,
        )

    base = _site_base(request)
    site_name = getattr(settings, 'SITE_NAME', 'Hotpulse')

    try:
        from apps.videos.models import Video

        # Slug veya sayısal ID ile bul
        qs = Video.objects.select_related('creator').filter(
            is_published=True,
            moderation_status='approved',
        )
        if str(slug).isdigit():
            video = qs.get(id=int(slug))
        else:
            video = qs.get(slug=slug)

        title = (video.title or 'Video').strip()
        raw_desc = (video.description or '').replace('\n', ' ').strip()
        desc = raw_desc[:250] + ('…' if len(raw_desc) > 250 else '')
        thumb = video.thumbnail_url or ''
        creator_name = video.creator.username if video.creator else ''
        upload_date = video.created_at.date().isoformat() if video.created_at else ''
        duration_iso = _seconds_to_iso8601(video.duration)
        view_count = video.view_count or 0
        page_url = f'{base}/videos/{slug}'

        # ── Open Graph + Twitter Card meta tagları ────────────────────────
        og_image_tags = ''
        if thumb:
            og_image_tags = f'''
  <meta property="og:image" content="{xml_escape(thumb)}" />
  <meta property="og:image:width" content="1280" />
  <meta property="og:image:height" content="720" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta name="twitter:image" content="{xml_escape(thumb)}" />'''

        meta_block = f'''
  <!-- Server-side SEO (Django) -->
  <title>{xml_escape(title)} — {xml_escape(site_name)}</title>
  <meta name="description" content="{xml_escape(desc)}" />
  <link rel="canonical" href="{xml_escape(page_url)}" />
  <meta property="og:type" content="video.other" />
  <meta property="og:title" content="{xml_escape(title)}" />
  <meta property="og:description" content="{xml_escape(desc)}" />
  <meta property="og:url" content="{xml_escape(page_url)}" />
  <meta property="og:site_name" content="{xml_escape(site_name)}" />{og_image_tags}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{xml_escape(title)}" />
  <meta name="twitter:description" content="{xml_escape(desc)}" />'''

        # ── JSON-LD VideoObject ────────────────────────────────────────────
        ld: dict = {
            '@context': 'https://schema.org',
            '@type': 'VideoObject',
            'name': title,
            'description': desc,
            'url': page_url,
            'uploadDate': upload_date,
            'interactionStatistic': {
                '@type': 'InteractionCounter',
                'interactionType': 'https://schema.org/WatchAction',
                'userInteractionCount': view_count,
            },
        }
        if thumb:
            ld['thumbnailUrl'] = thumb
        if duration_iso:
            ld['duration'] = duration_iso
        if creator_name:
            ld['author'] = {'@type': 'Person', 'name': creator_name}

        json_ld_block = (
            '  <script type="application/ld+json">\n'
            f'  {json.dumps(ld, ensure_ascii=False, separators=(",", ":"))}\n'
            '  </script>'
        )

        html = _inject_into_head(html, meta_block + '\n' + json_ld_block)

    except Exception:
        # Video bulunamadı veya hata — normal SPA sayfası döner
        pass

    return HttpResponse(html, content_type='text/html; charset=utf-8')
