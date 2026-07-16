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

# ── Korumalı / kişisel yollar — noindex verilmeli ────────────────────────────
_NOINDEX_PREFIXES: tuple[str, ...] = (
    "/admin", "/profile", "/history", "/bookmarks", "/notifications",
    "/upload", "/messages", "/my-requests", "/creator/dashboard",
    "/playlists", "/subscriptions", "/affiliate", "/payment",
    "/developer", "/settings", "/crosspost-jobs", "/downloads",
    "/match", "/leaderboard",
)


def _is_private_path(path: str) -> bool:
    p = path.rstrip("/")
    return any(p == pre or p.startswith(pre + "/") for pre in _NOINDEX_PREFIXES)


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


def _build_website_schema(site_name: str, base_url: str) -> str:
    """
    WebSite + SearchAction JSON-LD — Google'ın sitelinks searchbox özelliğini aktif eder.
    Tüm sayfalara enjekte edilir (bir kez indexlenince yeterli).
    """
    ld = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": site_name,
        "url": base_url,
        "potentialAction": {
            "@type": "SearchAction",
            "target": {
                "@type": "EntryPoint",
                "urlTemplate": f"{base_url}/search?q={{search_term_string}}",
            },
            "query-input": "required name=search_term_string",
        },
    }
    return (
        '  <script type="application/ld+json">\n'
        f"  {json.dumps(ld, ensure_ascii=False, separators=(',', ':'))}\n"
        "  </script>"
    )


def _resource_exists(path: str) -> bool | None:
    """
    DB-backed resource varlığını kontrol eder.
    None → path'e özel kontrol yok (genel sayfa)
    True → kaynak bulundu
    False → kaynak yok → 404 dönülmeli
    """
    import re as _re
    from urllib.parse import unquote

    # /category/<slug>
    m = _re.match(r"^/category/([^/?#]+)/?$", path)
    if m:
        try:
            from apps.videos.models import Category
            return Category.objects.filter(slug=unquote(m.group(1))).exists()
        except Exception:
            return None

    # /creator/<id>
    m = _re.match(r"^/creator/(\d+)/?$", path)
    if m:
        try:
            from apps.accounts.models import User
            return User.objects.filter(id=int(m.group(1))).exists()
        except Exception:
            return None

    # /profile/<id>
    m = _re.match(r"^/profile/(\d+)/?$", path)
    if m:
        try:
            from apps.accounts.models import User
            return User.objects.filter(id=int(m.group(1))).exists()
        except Exception:
            return None

    return None  # genel sayfa, DB kontrolü gerekmez


def _build_simple_meta(title: str, desc: str, canonical: str, og_image: str = "", og_type: str = "website") -> str:
    """Sayfa-spesifik override meta bloğu — global meta'nın üstüne enjekte edilerek title/desc'i değiştirir."""
    esc = xml_escape
    parts = [
        "  <!-- Sayfa SEO (Django) -->",
        f"  <title>{esc(title)}</title>",
        f'  <meta name="description" content="{esc(desc)}" />',
        f'  <link rel="canonical" href="{esc(canonical)}" />',
        f'  <meta property="og:title" content="{esc(title)}" />',
        f'  <meta property="og:description" content="{esc(desc)}" />',
        f'  <meta property="og:type" content="{esc(og_type)}" />',
        f'  <meta property="og:url" content="{esc(canonical)}" />',
        f'  <meta name="twitter:title" content="{esc(title)}" />',
        f'  <meta name="twitter:description" content="{esc(desc)}" />',
    ]
    if og_image:
        parts += [
            f'  <meta property="og:image" content="{esc(og_image)}" />',
            f'  <meta name="twitter:image" content="{esc(og_image)}" />',
        ]
    return "\n".join(parts)


def _build_page_meta(path: str, query_string: str, seo, base_url: str, canonical: str) -> str | None:
    """
    URL path'ine göre sayfa-spesifik meta üretir.
    None dönerse global (site-wide) meta kullanılır.
    """
    import re as _re
    from urllib.parse import unquote, parse_qs

    site_name = (seo.site_title if seo else "") or "Hotpulse"
    og_image  = (seo.og_image  if seo else "") or ""
    p = path.rstrip("/") or "/"

    # ── Statik sayfalar ───────────────────────────────────────────────────────
    static: dict[str, tuple[str, str]] = {
        "/videos":     (f"Tüm Videolar — {site_name}",
                        "Popüler, yeni ve trend videoları keşfet. Favori içeriklerini bul."),
        "/categories": (f"Kategoriler — {site_name}",
                        "Tüm video kategorilerini keşfet. İlgini çeken konuları izle."),
        "/creators":   (f"İçerik Üreticileri — {site_name}",
                        "Favori içerik üreticilerini takip et. Yeni kanallar keşfet."),
        "/live":       (f"Canlı Yayınlar — {site_name}",
                        "Şu an canlı yayın yapan içerik üreticilerini izle. Gerçek zamanlı eğlence."),
        "/shorts":     (f"Shorts — {site_name}",
                        "Kısa ve eğlenceli videolar. Kaydır, keşfet, izle."),
        "/pricing":    (f"Abonelik Planları — {site_name}",
                        "Uygun fiyatlı premium aboneliklerle daha fazla içeriğe eriş."),
    }
    if p in static:
        title, desc = static[p]
        return _build_simple_meta(title, desc, canonical, og_image)

    # ── /search?q=... ─────────────────────────────────────────────────────────
    if p == "/search":
        qs = parse_qs(query_string)
        q = qs.get("q", [""])[0].strip()
        if q:
            return _build_simple_meta(
                f'"{q}" — Arama Sonuçları — {site_name}',
                f'"{q}" ile ilgili video ve içerikler.',
                canonical, og_image,
            )
        return _build_simple_meta(
            f"Video Ara — {site_name}",
            "Milyonlarca video içeriği arasında arama yap.",
            canonical, og_image,
        )

    # ── /category/<slug> — DB'den kategori adı + BreadcrumbList JSON-LD ────────
    m = _re.match(r"^/category/([^/?#]+)$", p)
    if m:
        slug = unquote(m.group(1))
        cat_name = slug.replace("-", " ").title()
        cat_desc = f"{cat_name} kategorisindeki tüm videolar."
        try:
            from apps.videos.models import Category
            cat = Category.objects.filter(slug=slug).values("name", "description").first()
            if cat:
                cat_name = cat["name"] or cat_name
                cat_desc = (cat["description"] or cat_desc).strip()[:250]
        except Exception:
            pass

        simple = _build_simple_meta(f"{cat_name} Videoları — {site_name}", cat_desc, canonical, og_image)
        breadcrumb_ld = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Ana Sayfa",  "item": base_url + "/"},
                {"@type": "ListItem", "position": 2, "name": "Kategoriler","item": base_url + "/categories"},
                {"@type": "ListItem", "position": 3, "name": cat_name,     "item": canonical},
            ],
        }
        breadcrumb_block = (
            '  <script type="application/ld+json">\n'
            f"  {json.dumps(breadcrumb_ld, ensure_ascii=False, separators=(',', ':'))}\n"
            "  </script>"
        )
        return simple + "\n" + breadcrumb_block

    # ── /creator/<id> veya /profile/<id> — DB'den kullanıcı + Person JSON-LD ──
    for pat in [r"^/creator/(\d+)$", r"^/profile/(\d+)$"]:
        m = _re.match(pat, p)
        if m:
            uid = int(m.group(1))
            try:
                from apps.accounts.models import User
                u = User.objects.filter(id=uid).values(
                    "username", "display_name", "bio", "avatar_url"
                ).first()
                if u:
                    name   = u.get("display_name") or u.get("username") or f"Creator {uid}"
                    bio    = (u.get("bio") or f"{name} kanalı — tüm videolar ve içerikler.").strip()[:250]
                    avatar = u.get("avatar_url") or og_image

                    simple = _build_simple_meta(f"{name} — {site_name}", bio, canonical, avatar, "profile")
                    person_ld: dict = {
                        "@context": "https://schema.org",
                        "@type": "Person",
                        "name": name,
                        "url": canonical,
                        "description": bio,
                    }
                    if avatar:
                        person_ld["image"] = avatar
                    person_block = (
                        '  <script type="application/ld+json">\n'
                        f"  {json.dumps(person_ld, ensure_ascii=False, separators=(',', ':'))}\n"
                        "  </script>"
                    )
                    return simple + "\n" + person_block
            except Exception:
                pass

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
    Tüm SPA sayfaları için SEO meta enjekte edilmiş index.html döner.

    Strateji:
    1. DB-backed sayfalar için kaynak varlığı kontrol edilir → 404
    2. Korumalı / kişisel sayfalar → noindex meta enjekte edilir
    3. Global meta (site doğrulama kodları, twitter handle, Organization schema…)
    4. WebSite + SearchAction JSON-LD (sitelinks searchbox)
    5. Sayfa-spesifik override (title / description / canonical / OG / JSON-LD)
    6. Anonim kullanıcılar için init verisi HTML içine gömülür
    """
    path = request.path

    # ── 1. DB-backed kaynak varlık kontrolü (404) ─────────────────────────────
    exists = _resource_exists(path)
    if exists is False:
        html = _read_index_html() or "<!DOCTYPE html><html><body><p>Sayfa bulunamadı.</p></body></html>"
        return HttpResponse(html, content_type="text/html; charset=utf-8", status=404)

    html = _read_index_html()
    if not html:
        return HttpResponse(
            "<!DOCTYPE html><html><body><p>Frontend build edilmemiş.</p></body></html>",
            content_type="text/html",
            status=503,
        )

    base      = _site_base(request)
    canonical = base + path
    seo       = _get_seo_settings()
    qs        = request.META.get("QUERY_STRING", "")
    site_name = (seo.site_title if seo else "") or "Hotpulse"

    # ── 2. Korumalı sayfalar → noindex, nofollow ──────────────────────────────
    if _is_private_path(path):
        html = _inject_into_head(html, '  <meta name="robots" content="noindex, nofollow" />')

    # ── 3. Global meta (doğrulama kodları, twitter:site, Organization schema…) ─
    global_meta = _build_global_meta(seo, base, canonical)
    if global_meta:
        html = _inject_into_head(html, global_meta)

    # ── 4. WebSite + SearchAction JSON-LD (sitelinks searchbox) ──────────────
    website_schema = _build_website_schema(site_name, base)
    html = _inject_into_head(html, website_schema)

    # ── 5. Sayfa-spesifik title/desc/OG/JSON-LD — global'ı override eder ─────
    page_meta = _build_page_meta(path, qs, seo, base, canonical)
    if page_meta:
        html = _inject_into_head(html, page_meta)

    # ── 6. Anonim kullanıcılar için init verisini HTML'e göm ─────────────────
    if not request.user.is_authenticated:
        inline = _build_inline_init()
        if inline:
            html = _inject_into_head(html, inline)

    resp = HttpResponse(html, content_type="text/html; charset=utf-8")
    resp["Cache-Control"] = "no-cache"
    resp["Last-Modified"] = time.strftime("%a, %d %b %Y %H:%M:%S GMT", time.gmtime())
    resp["Link"] = (
        '</.well-known/api-catalog>; rel="api-catalog", '
        '</api/healthz>; rel="service-desc", '
        '</sitemap.xml>; rel="sitemap"'
    )
    return resp


def video_seo_page(request, slug):
    """
    /videos/<slug> → server-side OG + og:video + JSON-LD VideoObject + Last-Modified.
    Video bulunamazsa gerçek 404 döner.
    """
    html = _read_index_html()
    if not html:
        return HttpResponse(
            "<!DOCTYPE html><html><body><p>Build edilmemiş frontend.</p></body></html>",
            content_type="text/html",
            status=503,
        )

    base     = _site_base(request)
    page_url = f"{base}/videos/{slug}"
    seo      = _get_seo_settings()
    site_name = getattr(settings, "SITE_NAME", (seo.site_title if seo else "") or "Hotpulse")

    # Global meta (doğrulama kodları vb.)
    global_meta = _build_global_meta(seo, base, page_url)
    if global_meta:
        html = _inject_into_head(html, global_meta)

    # WebSite + SearchAction JSON-LD
    html = _inject_into_head(html, _build_website_schema(site_name, base))

    # ── Video-spesifik meta ───────────────────────────────────────────────────
    video_updated_at = None
    try:
        from apps.videos.models import Video
        from django.core.exceptions import ObjectDoesNotExist

        fqs = Video.objects.select_related("creator").filter(
            is_published=True, moderation_status="approved",
        )
        try:
            video = fqs.get(id=int(slug)) if str(slug).isdigit() else fqs.get(slug=slug)
        except (Video.DoesNotExist, ObjectDoesNotExist, ValueError):
            # Video yok veya yayınlanmamış → 404
            resp = HttpResponse(html, content_type="text/html; charset=utf-8", status=404)
            resp["Cache-Control"] = "no-cache"
            return resp

        video_updated_at = video.updated_at
        title        = (video.title or "Video").strip()
        raw_desc     = (video.description or "").replace("\n", " ").strip()
        desc         = raw_desc[:250] + ("…" if len(raw_desc) > 250 else "")
        thumb        = video.thumbnail_url or ""
        vid_url      = video.video_url or ""
        creator_name = video.creator.username if video.creator else ""
        upload_date  = video.created_at.date().isoformat() if video.created_at else ""
        duration_iso = _seconds_to_iso8601(video.duration)
        view_count   = video.view_count or 0

        # OG image
        og_image_tags = ""
        if thumb:
            og_image_tags = (
                f'\n  <meta property="og:image" content="{xml_escape(thumb)}" />'
                '\n  <meta property="og:image:width" content="1280" />'
                '\n  <meta property="og:image:height" content="720" />'
                '\n  <meta property="og:image:type" content="image/jpeg" />'
                f'\n  <meta name="twitter:image" content="{xml_escape(thumb)}" />'
            )

        # og:video — Facebook/Twitter'da video oynatıcı gösterir
        og_video_tags = ""
        if vid_url:
            og_video_tags = (
                f'\n  <meta property="og:video" content="{xml_escape(vid_url)}" />'
                '\n  <meta property="og:video:type" content="video/mp4" />'
                '\n  <meta property="og:video:width" content="1280" />'
                '\n  <meta property="og:video:height" content="720" />'
            )

        meta_block = (
            "\n  <!-- Video SEO (Django) -->"
            f"\n  <title>{xml_escape(title)} — {xml_escape(site_name)}</title>"
            f'\n  <meta name="description" content="{xml_escape(desc)}" />'
            f'\n  <link rel="canonical" href="{xml_escape(page_url)}" />'
            '\n  <meta property="og:type" content="video.other" />'
            f'\n  <meta property="og:title" content="{xml_escape(title)}" />'
            f'\n  <meta property="og:description" content="{xml_escape(desc)}" />'
            f'\n  <meta property="og:url" content="{xml_escape(page_url)}" />'
            f'\n  <meta property="og:site_name" content="{xml_escape(site_name)}" />'
            + og_image_tags
            + og_video_tags
            + '\n  <meta name="twitter:card" content="summary_large_image" />'
            f'\n  <meta name="twitter:title" content="{xml_escape(title)}" />'
            f'\n  <meta name="twitter:description" content="{xml_escape(desc)}" />'
        )

        # VideoObject JSON-LD
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
        if vid_url:
            ld["contentUrl"] = vid_url
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

    # Anonim kullanıcılar için init verisini HTML'e göm
    if not request.user.is_authenticated:
        inline = _build_inline_init()
        if inline:
            html = _inject_into_head(html, inline)

    resp = HttpResponse(html, content_type="text/html; charset=utf-8")
    resp["Cache-Control"] = "no-cache"
    if video_updated_at:
        resp["Last-Modified"] = video_updated_at.strftime("%a, %d %b %Y %H:%M:%S GMT")
    resp["Link"] = (
        '</.well-known/api-catalog>; rel="api-catalog", '
        '</api/healthz>; rel="service-desc", '
        '</sitemap.xml>; rel="sitemap"'
    )
    return resp
