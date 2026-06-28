"""
Server-side SEO:
- /videos/<slug>  → OG meta + JSON-LD VideoObject enjekte eder
- Tüm diğer sayfalar → Admin SEO ayarlarından global meta inject eder
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
    if '</head>' in html:
        return html.replace('</head>', content + '\n</head>', 1)
    return html


def _get_seo_settings():
    try:
        from apps.admin_panel.models import SeoSettings
        s, _ = SeoSettings.objects.get_or_create(id=1)
        return s
    except Exception:
        return None


def _build_global_meta(seo, base_url: str, canonical: str) -> str:
    """Admin SEO ayarlarından tüm sayfalar için global meta tag bloğu üretir."""
    if not seo:
        return ''

    parts = ['  <!-- Global SEO (Django) -->']

    title = seo.site_title or ''
    desc = seo.site_description or ''
    keywords = seo.keywords or ''

    if title:
        parts.append(f'  <title>{xml_escape(title)}</title>')
    if desc:
        parts.append(f'  <meta name="description" content="{xml_escape(desc)}" />')
    if keywords:
        parts.append(f'  <meta name="keywords" content="{xml_escape(keywords)}" />')
    if seo.robots:
        parts.append(f'  <meta name="robots" content="{xml_escape(seo.robots)}" />')
    if seo.hreflang:
        parts.append(f'  <meta http-equiv="content-language" content="{xml_escape(seo.hreflang)}" />')

    parts.append(f'  <link rel="canonical" href="{xml_escape(canonical)}" />')

    # Open Graph
    og_title = seo.og_title or title
    og_desc = seo.og_description or desc
    og_image = seo.og_image or ''
    if og_title:
        parts.append(f'  <meta property="og:title" content="{xml_escape(og_title)}" />')
    if og_desc:
        parts.append(f'  <meta property="og:description" content="{xml_escape(og_desc)}" />')
    parts.append(f'  <meta property="og:type" content="{xml_escape(seo.og_type or "website")}" />')
    parts.append(f'  <meta property="og:url" content="{xml_escape(canonical)}" />')
    parts.append(f'  <meta property="og:site_name" content="{xml_escape(title)}" />')
    if og_image:
        parts.append(f'  <meta property="og:image" content="{xml_escape(og_image)}" />')
        parts.append(f'  <meta property="og:image:width" content="1200" />')
        parts.append(f'  <meta property="og:image:height" content="630" />')

    # Twitter Card
    parts.append(f'  <meta name="twitter:card" content="{xml_escape(seo.twitter_card or "summary_large_image")}" />')
    if og_title:
        parts.append(f'  <meta name="twitter:title" content="{xml_escape(og_title)}" />')
    if og_desc:
        parts.append(f'  <meta name="twitter:description" content="{xml_escape(og_desc)}" />')
    if og_image:
        parts.append(f'  <meta name="twitter:image" content="{xml_escape(og_image)}" />')
    if seo.twitter_site:
        parts.append(f'  <meta name="twitter:site" content="{xml_escape(seo.twitter_site)}" />')

    # Arama motoru doğrulama kodları
    if seo.google_search_console:
        parts.append(f'  <meta name="google-site-verification" content="{xml_escape(seo.google_search_console)}" />')
    if seo.bing_verification:
        parts.append(f'  <meta name="msvalidate.01" content="{xml_escape(seo.bing_verification)}" />')
    if seo.yandex_verification:
        parts.append(f'  <meta name="yandex-verification" content="{xml_escape(seo.yandex_verification)}" />')


    # JSON-LD Organization/WebSite
    if seo.structured_data_enabled:
        ld = {
            '@context': 'https://schema.org',
            '@type': seo.schema_org_type or 'Organization',
            'name': title,
            'url': base_url,
        }
        if og_image:
            ld['logo'] = og_image
        if desc:
            ld['description'] = desc
        parts.append(
            '  <script type="application/ld+json">\n'
            f'  {json.dumps(ld, ensure_ascii=False, separators=(",", ":"))}\n'
            '  </script>'
        )

    return '\n'.join(parts)


def global_seo_page(request):
    """
    Tüm SPA sayfaları için global SEO meta enjekte edilmiş index.html döner.
    """
    html = _read_index_html()
    if not html:
        return HttpResponse(
            '<!DOCTYPE html><html><body><p>Frontend build edilmemiş.</p></body></html>',
            content_type='text/html', status=503,
        )

    base = _site_base(request)
    canonical = base + request.path
    seo = _get_seo_settings()
    meta = _build_global_meta(seo, base, canonical)
    if meta:
        html = _inject_into_head(html, meta)

    return HttpResponse(html, content_type='text/html; charset=utf-8')


def video_seo_page(request, slug):
    """
    /videos/<slug> için server-side OG + JSON-LD VideoObject enjeksiyonlu index.html.
    """
    html = _read_index_html()
    if not html:
        return HttpResponse(
            '<!DOCTYPE html><html><body><p>Build edilmemiş frontend.</p></body></html>',
            content_type='text/html', status=503,
        )

    base = _site_base(request)
    page_url = f'{base}/videos/{slug}'
    seo = _get_seo_settings()

    # Önce global meta enjekte et
    global_meta = _build_global_meta(seo, base, page_url)
    if global_meta:
        html = _inject_into_head(html, global_meta)

    # Sonra video-spesifik meta ile üzerine yaz
    try:
        from apps.videos.models import Video
        qs = Video.objects.select_related('creator').filter(
            is_published=True, moderation_status='approved',
        )
        video = qs.get(id=int(slug)) if str(slug).isdigit() else qs.get(slug=slug)

        title = (video.title or 'Video').strip()
        raw_desc = (video.description or '').replace('\n', ' ').strip()
        desc = raw_desc[:250] + ('…' if len(raw_desc) > 250 else '')
        thumb = video.thumbnail_url or ''
        creator_name = video.creator.username if video.creator else ''
        upload_date = video.created_at.date().isoformat() if video.created_at else ''
        duration_iso = _seconds_to_iso8601(video.duration)
        view_count = video.view_count or 0
        site_name = getattr(settings, 'SITE_NAME', seo.site_title if seo else 'Soci')

        og_image_tags = ''
        if thumb:
            og_image_tags = f'''
  <meta property="og:image" content="{xml_escape(thumb)}" />
  <meta property="og:image:width" content="1280" />
  <meta property="og:image:height" content="720" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta name="twitter:image" content="{xml_escape(thumb)}" />'''

        meta_block = f'''
  <!-- Video SEO (Django) -->
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
        pass

    return HttpResponse(html, content_type='text/html; charset=utf-8')
