"""
/sitemap.xml         — sitemap index → alt sitemaplere yönlendirir
/sitemap-pages.xml   — statik sayfalar + kategoriler + creator profilleri
/sitemap-videos.xml  — Google Video Sitemap (tam metadata) formatında tüm onaylı videolar
/robots.txt          — botlara izin/yasak ve sitemap konumu bildirir
"""
from django.http import HttpResponse
from django.conf import settings
from django.utils.timezone import now as tz_now
from xml.sax.saxutils import escape


def _site_url() -> str:
    url = getattr(settings, "SITE_URL", "")
    if not url:
        url = "https://hotpulse.me"
    return url.rstrip("/")


def _url_entry(
    loc: str,
    lastmod: str | None = None,
    changefreq: str = "weekly",
    priority: str = "0.5",
) -> str:
    parts = [f"  <url>\n    <loc>{escape(loc)}</loc>"]
    if lastmod:
        parts.append(f"    <lastmod>{lastmod}</lastmod>")
    parts.append(f"    <changefreq>{changefreq}</changefreq>")
    parts.append(f"    <priority>{priority}</priority>")
    parts.append("  </url>")
    return "\n".join(parts)


# ── /sitemap.xml — index ──────────────────────────────────────────────────────

def sitemap_xml(request):
    """Sitemap index — alt sitemaplere yönlendirir (pages + videos)."""
    base  = _site_url()
    today = tz_now().date().isoformat()
    content = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f'  <sitemap>\n'
        f'    <loc>{escape(base)}/sitemap-pages.xml</loc>\n'
        f'    <lastmod>{today}</lastmod>\n'
        f'  </sitemap>\n'
        f'  <sitemap>\n'
        f'    <loc>{escape(base)}/sitemap-videos.xml</loc>\n'
        f'    <lastmod>{today}</lastmod>\n'
        f'  </sitemap>\n'
        '</sitemapindex>'
    )
    return HttpResponse(content, content_type="application/xml; charset=utf-8")


# ── /sitemap-pages.xml ────────────────────────────────────────────────────────

def sitemap_pages_xml(request):
    """Statik sayfalar, kategoriler ve herkese açık creator profilleri."""
    base  = _site_url()
    today = tz_now().date().isoformat()
    entries: list[str] = []

    # Statik sayfalar
    static_pages = [
        ("/",           "daily",   "1.0"),
        ("/videos",     "hourly",  "0.9"),
        ("/shorts",     "daily",   "0.8"),
        ("/live",       "hourly",  "0.8"),
        ("/creators",   "daily",   "0.7"),
        ("/categories", "weekly",  "0.6"),
        ("/pricing",    "monthly", "0.5"),
        ("/search",     "daily",   "0.6"),
    ]
    for path, freq, pri in static_pages:
        entries.append(_url_entry(f"{base}{path}", today, freq, pri))

    # Kategoriler
    try:
        from apps.videos.models import Category
        for cat in Category.objects.values("slug"):
            if cat["slug"]:
                entries.append(
                    _url_entry(f"{base}/category/{escape(cat['slug'])}", today, "weekly", "0.6")
                )
    except Exception:
        pass

    # Creator profilleri (role="creator" olan kullanıcılar)
    try:
        from apps.accounts.models import User
        creators = (
            User.objects.filter(role="creator")
            .values("id", "updated_at")
            .order_by("-id")[:5000]
        )
        for u in creators:
            lastmod = u["updated_at"].date().isoformat() if u.get("updated_at") else today
            entries.append(_url_entry(f"{base}/creator/{u['id']}", lastmod, "weekly", "0.6"))
    except Exception:
        pass

    # Özel sayfalar (CustomPage)
    try:
        from apps.videos.models import CustomPage
        for p in CustomPage.objects.filter(is_published=True).values("slug"):
            if p["slug"]:
                entries.append(
                    _url_entry(f"{base}/page/{escape(p['slug'])}", today, "monthly", "0.5")
                )
    except Exception:
        pass

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n'
        '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 '
        'http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n'
        + "\n".join(entries)
        + "\n</urlset>"
    )
    return HttpResponse(xml, content_type="application/xml; charset=utf-8")


# ── /sitemap-videos.xml ───────────────────────────────────────────────────────

def sitemap_videos_xml(request):
    """
    Google Video Sitemap formatında tüm onaylı, yayınlanmış videolar.
    Her <url> içinde <video:video> bloğu bulunur.
    Referans: https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps
    """
    base  = _site_url()
    today = tz_now().date().isoformat()
    entries: list[str] = []

    try:
        from apps.videos.models import Video
        videos = (
            Video.objects
            .filter(is_published=True, moderation_status="approved")
            .exclude(type="live")
            .values(
                "slug", "id", "title", "description",
                "thumbnail_url", "video_url", "duration",
                "is_premium", "created_at", "updated_at",
                "creator__username",
            )
            .order_by("-updated_at")[:50000]
        )

        for v in videos:
            identifier = v["slug"] or v["id"]
            if not identifier:
                continue

            page_url = f"{base}/videos/{escape(str(identifier))}"
            lastmod  = v["updated_at"].date().isoformat() if v["updated_at"] else today
            pub_date = v["created_at"].date().isoformat() if v["created_at"] else today

            title    = escape((v["title"] or "Video").strip()[:100])
            raw_desc = (v["description"] or "").replace("\n", " ").strip()
            desc     = escape(raw_desc[:2048])
            thumb    = v["thumbnail_url"] or ""
            vid_url  = v["video_url"] or ""
            duration = v["duration"]
            creator  = v.get("creator__username") or ""
            premium  = v.get("is_premium", False)

            parts = [
                "  <url>",
                f"    <loc>{page_url}</loc>",
                f"    <lastmod>{lastmod}</lastmod>",
                "    <changefreq>weekly</changefreq>",
                "    <priority>0.8</priority>",
                "    <video:video>",
                f"      <video:title>{title}</video:title>",
                f"      <video:description>{desc}</video:description>",
                f"      <video:publication_date>{pub_date}</video:publication_date>",
                "      <video:family_friendly>no</video:family_friendly>",
                "      <video:live>no</video:live>",
                f"      <video:requires_subscription>{'yes' if premium else 'no'}</video:requires_subscription>",
                "      <video:platform relationship=\"allow\">web mobile</video:platform>",
            ]
            if thumb:
                parts.append(f"      <video:thumbnail_loc>{escape(thumb)}</video:thumbnail_loc>")
            if vid_url:
                parts.append(f"      <video:content_loc>{escape(vid_url)}</video:content_loc>")
            if duration and duration > 0:
                parts.append(f"      <video:duration>{int(duration)}</video:duration>")
            if creator:
                parts.append(f"      <video:uploader>{escape(creator)}</video:uploader>")
            parts += [
                "    </video:video>",
                "  </url>",
            ]
            entries.append("\n".join(parts))
    except Exception:
        pass

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n'
        '        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"\n'
        '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n'
        '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 '
        'http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n'
        + "\n".join(entries)
        + "\n</urlset>"
    )
    return HttpResponse(xml, content_type="application/xml; charset=utf-8")


# ── /robots.txt ───────────────────────────────────────────────────────────────

def robots_txt(request):
    base = _site_url()
    content = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /api/\n"
        "Disallow: /django-admin/\n"
        "Disallow: /admin/\n"
        "Disallow: /history\n"
        "Disallow: /bookmarks\n"
        "Disallow: /notifications\n"
        "Disallow: /messages\n"
        "Disallow: /upload\n"
        "Disallow: /my-requests\n"
        "Disallow: /crosspost-jobs\n"
        "Disallow: /affiliate\n"
        "Disallow: /developer\n"
        "Disallow: /payment\n"
        "Disallow: /downloads\n"
        "\n"
        f"Sitemap: {base}/sitemap.xml\n"
    )
    return HttpResponse(content, content_type="text/plain; charset=utf-8")
