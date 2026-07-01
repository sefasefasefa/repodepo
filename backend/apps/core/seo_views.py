"""
Server-side SEO:
- /videos/<slug>  → OG meta + JSON-LD VideoObject enjekte eder
- Tüm diğer sayfalar → Admin SEO ayarlarından global meta inject eder

Performans:
- index.html içeriği bellek önbelleğinde tutulur (5 dk TTL)
- SeoSettings DB sorgusu 60 s önbelleğe alınır
"""
import os
import json
import time
from xml.sax.saxutils import escape as xml_escape
from django.conf import settings
from django.http import HttpResponse

# ── Bellek önbelleği ──────────────────────────────────────────────────────────

_html_cache: dict = {"content": None, "ts": 0.0}
_HTML_TTL = 300  # 5 dakika

_seo_cache: dict = {"obj": None, "ts": 0.0}
_SEO_TTL = 60  # 1 dakika


def _read_index_html() -> str | None:
    now = time.monotonic()
    if _html_cache["content"] is not None and (now - _html_cache["ts"]) < _HTML_TTL:
        return _html_cache["content"]

    candidates = list(settings.STATICFILES_DIRS) + [settings.STATIC_ROOT]
    for root in candidates:
        p = os.path.join(str(root), "index.html")
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                content = f.read()
            _html_cache["content"] = content
            _html_cache["ts"] = now
            return content
    return None


def _site_base(request) -> str:
    url = getattr(settings, "SITE_URL", "") or ""
    if url:
        return url.rstrip("/")
    return request.build_absolute_uri("/").rstrip("/")


def _seconds_to_iso8601(seconds: int | None) -> str | None:
    if not seconds or seconds <= 0:
        return None
    h, rem = divmod(int(seconds), 3600)
    m, s = divmod(rem, 60)
    iso = "PT"
    if h:
        iso += f"{h}H"
    if m:
        iso += f"{m}M"
    if s or not (h or m):
        iso += f"{s}S"
    return iso


def _inject_into_head(html: str, content: str) -> str:
    if "</head>" in html:
        return html.replace("</head>", content + "\n</head>", 1)
    return html


def _get_seo_settings():
    now = time.monotonic()
    if _seo_cache["obj"] is not None and (now - _seo_cache["ts"]) < _SEO_TTL:
        return _seo_cache["obj"]

    try:
        from apps.admin_panel.models import SeoSettings
        s, _ = SeoSettings.objects.get_or_create(id=1)
        _seo_cache["obj"] = s
        _seo_cache["ts"] = now
        return s
    except Exception:
        return None


def _build_global_meta(seo, base_url: str, canonical: str) -> str:
    """Admin SEO ayarlarından tüm sayfalar için global meta tag bloğu üretir."""
    if not seo:
        return ""

    parts = ["  <!-- Global SEO (Django) -->"]

    title = seo.site_title or ""
    desc = seo.site_description or ""
    keywords = seo.keywords or ""

    if title:
        parts.append(f"  <title>{xml_escape(title)}</title>")
    if desc:
        parts.append(f'  <meta name="description" content="{xml_escape(desc)}" />')
    if keywords:
        parts.append(f'  <meta name="keywords" content="{xml_escape(keywords)}" />')
    if seo.robots:
        parts.append(f'  <meta name="robots" content="{xml_escape(seo.robots)}" />')
    if seo.hreflang:
        parts.append(
            f'  <meta http-equiv="content-language" content="{xml_escape(seo.hreflang)}" />'
        )

    parts.append(f'  <link rel="canonical" href="{xml_escape(canonical)}" />')

    # Open Graph
    og_title = seo.og_title or title
    og_desc = seo.og_description or desc
    og_image = seo.og_image or ""
    if og_title:
        parts.append(f'  <meta property="og:title" content="{xml_escape(og_title)}" />')
    if og_desc:
        parts.append(
            f'  <meta property="og:description" content="{xml_escape(og_desc)}" />'
        )
    parts.append(
        f'  <meta property="og:type" content="{xml_escape(seo.og_type or "website")}" />'
    )
    parts.append(f'  <meta property="og:url" content="{xml_escape(canonical)}" />')
    parts.append(f'  <meta property="og:site_name" content="{xml_escape(title)}" />')
    if og_image:
        parts.append(
            f'  <meta property="og:image" content="{xml_escape(og_image)}" />'
        )
        parts.append('  <meta property="og:image:width" content="1200" />')
        parts.append('  <meta property="og:image:height" content="630" />')

    # Twitter Card
    parts.append(
        f'  <meta name="twitter:card" content="{xml_escape(seo.twitter_card or "summary_large_image")}" />'
    )
    if og_title:
        parts.append(
            f'  <meta name="twitter:title" content="{xml_escape(og_title)}" />'
        )
    if og_desc:
        parts.append(
            f'  <meta name="twitter:description" content="{xml_escape(og_desc)}" />'
        )
    if og_image:
        parts.append(
            f'  <meta name="twitter:image" content="{xml_escape(og_image)}" />'
        )
    if seo.twitter_site:
        parts.append(
            f'  <meta name="twitter:site" content="{xml_escape(seo.twitter_site)}" />'
        )

    # Arama motoru doğrulama kodları
    if seo.google_search_console:
        parts.append(
            f'  <meta name="google-site-verification" content="{xml_escape(seo.google_search_console)}" />'
        )
    if seo.bing_verification:
        parts.append(
            f'  <meta name="msvalidate.01" content="{xml_escape(seo.bing_verification)}" />'
        )
    if seo.yandex_verification:
        parts.append(
            f'  <meta name="yandex-verification" content="{xml_escape(seo.yandex_verification)}" />'
        )

    # JSON-LD Organization/WebSite
    if seo.structured_data_enabled:
        ld = {
            "@context": "https://schema.org",
            "@type": seo.schema_org_type or "Organization",
            "name": title,
            "url": base_url,
        }
        if og_image:
            ld["logo"] = og_image
        if desc:
            ld["description"] = desc
        parts.append(
            "  <script type=\"application/ld+json\">\n"
            f"  {json.dumps(ld, ensure_ascii=False, separators=(',', ':'))}\n"
            "  </script>"
        )

    return "\n".join(parts)


def _build_inline_init() -> str:
    """
    Anonim kullanıcılar için HTML'e gömülecek init JSON'unu hazırlar.
    Tek bir <script> tag'i döner — React bunu DOM'dan okuyarak /api/init fetch'ini atlar.
    """
    try:
        from django.core.cache import cache as _cache

        INLINE_KEY = "inline_init:v1"
        cached = _cache.get(INLINE_KEY)
        if cached is not None:
            return cached

        from apps.admin_panel.models import SiteSettings
        s, _ = SiteSettings.objects.get_or_create(id=1)
        site_config = {
            "siteName": s.site_name,
            "siteDescription": s.site_description,
            "logoUrl": s.logo_url,
            "faviconUrl": s.favicon_url,
            "primaryColor": s.primary_color,
            "registrationEnabled": s.registration_enabled,
            "maintenanceMode": s.maintenance_mode,
        }

        from apps.core.views import ensure_defaults, DEFAULT_FLAG_MAP
        from apps.core.models import FeatureFlag
        ensure_defaults()
        flags_qs = FeatureFlag.objects.all()
        flag_map = {f.key: f.state for f in flags_qs}
        details = [
            {
                "key": f.key, "state": f.state,
                "label": f.label or DEFAULT_FLAG_MAP.get(f.key, {}).get("label", f.key),
                "description": f.description or DEFAULT_FLAG_MAP.get(f.key, {}).get("description", ""),
                "group": DEFAULT_FLAG_MAP.get(f.key, {}).get("group", "Diğer"),
            }
            for f in flags_qs
        ]
        features = {"flags": flag_map, "details": details}

        from apps.videos.views import _build_home_data_anon
        home_data = _build_home_data_anon()

        payload = json.dumps(
            {"siteConfig": site_config, "features": features, "homeData": home_data, "me": None, "geo": None},
            ensure_ascii=False,
            separators=(",", ":"),
        )
        tag = f'<script id="__HP_INIT__" type="application/json">{payload}</script>'
        _cache.set(INLINE_KEY, tag, 120)
        return tag
    except Exception:
        return ""


def global_seo_page(request):
    """
    Tüm SPA sayfaları için global SEO meta enjekte edilmiş index.html döner.
    Anonim kullanıcılar için init verisi HTML içine gömülür → sıfır ekstra API isteği.
    """
    html = _read_index_html()
    if not html:
        return HttpResponse(
            "<!DOCTYPE html><html><body><p>Frontend build edilmemiş.</p></body></html>",
            content_type="text/html",
            status=503,
        )

    base = _site_base(request)
    canonical = base + request.path
    seo = _get_seo_settings()
    meta = _build_global_meta(seo, base, canonical)
    if meta:
        html = _inject_into_head(html, meta)

    # Anonim kullanıcılar için init verisini HTML'e göm
    if not request.user.is_authenticated:
        inline = _build_inline_init()
        if inline:
            html = _inject_into_head(html, inline)

    resp = HttpResponse(html, content_type="text/html; charset=utf-8")
    resp["Cache-Control"] = "no-cache"
    resp["Link"] = (
        '</.well-known/api-catalog>; rel="api-catalog", '
        '</api/healthz>; rel="service-desc", '
        '</sitemap.xml>; rel="sitemap"'
    )
    return resp


def video_seo_page(request, slug):
    """
    /videos/<slug> için server-side OG + JSON-LD VideoObject enjeksiyonlu index.html.
    """
    html = _read_index_html()
    if not html:
        return HttpResponse(
            "<!DOCTYPE html><html><body><p>Build edilmemiş frontend.</p></body></html>",
            content_type="text/html",
            status=503,
        )

    base = _site_base(request)
    page_url = f"{base}/videos/{slug}"
    seo = _get_seo_settings()

    # Önce global meta enjekte et
    global_meta = _build_global_meta(seo, base, page_url)
    if global_meta:
        html = _inject_into_head(html, global_meta)

    # Sonra video-spesifik meta ile üzerine yaz
    try:
        from apps.videos.models import Video

        qs = Video.objects.select_related("creator").filter(
            is_published=True, moderation_status="approved",
        )
        video = qs.get(id=int(slug)) if str(slug).isdigit() else qs.get(slug=slug)

        title = (video.title or "Video").strip()
        raw_desc = (video.description or "").replace("\n", " ").strip()
        desc = raw_desc[:250] + ("…" if len(raw_desc) > 250 else "")
        thumb = video.thumbnail_url or ""
        creator_name = video.creator.username if video.creator else ""
        upload_date = video.created_at.date().isoformat() if video.created_at else ""
        duration_iso = _seconds_to_iso8601(video.duration)
        view_count = video.view_count or 0
        site_name = getattr(settings, "SITE_NAME", seo.site_title if seo else "Soci")

        og_image_tags = ""
        if thumb:
            og_image_tags = f"""
  <meta property="og:image" content="{xml_escape(thumb)}" />
  <meta property="og:image:width" content="1280" />
  <meta property="og:image:height" content="720" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta name="twitter:image" content="{xml_escape(thumb)}" />"""

        meta_block = f"""
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
  <meta name="twitter:description" content="{xml_escape(desc)}" />"""

        ld: dict = {
            "@context": "https://schema.org",
            "@type": "VideoObject",
            "name": title,
            "description": desc,
            "url": page_url,
            "uploadDate": upload_date,
            "interactionStatistic": {
                "@type": "InteractionCounter",
                "interactionType": "https://schema.org/WatchAction",
                "userInteractionCount": view_count,
            },
        }
        if thumb:
            ld["thumbnailUrl"] = thumb
        if duration_iso:
            ld["duration"] = duration_iso
        if creator_name:
            ld["author"] = {"@type": "Person", "name": creator_name}

        json_ld_block = (
            '  <script type="application/ld+json">\n'
            f"  {json.dumps(ld, ensure_ascii=False, separators=(',', ':'))}\n"
            "  </script>"
        )
        html = _inject_into_head(html, meta_block + "\n" + json_ld_block)

    except Exception:
        pass

    # Anonim kullanıcılar için init verisini HTML'e göm — /api/init round-trip'ini ortadan kaldırır
    if not request.user.is_authenticated:
        inline = _build_inline_init()
        if inline:
            html = _inject_into_head(html, inline)

    resp = HttpResponse(html, content_type="text/html; charset=utf-8")
    resp["Cache-Control"] = "no-cache"
    resp["Link"] = (
        '</.well-known/api-catalog>; rel="api-catalog", '
        '</api/healthz>; rel="service-desc", '
        '</sitemap.xml>; rel="sitemap"'
    )
    return resp
