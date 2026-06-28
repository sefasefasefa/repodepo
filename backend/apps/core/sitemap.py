"""
/sitemap.xml  — yayınlanmış tüm video, kategori ve özel sayfaları listeler.
/robots.txt   — Google/Bing botlarına sitemap konumunu bildirir.
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


def _url_entry(loc: str, lastmod: str | None = None, changefreq: str = "weekly", priority: str = "0.5") -> str:
    parts = [f"  <url>\n    <loc>{escape(loc)}</loc>"]
    if lastmod:
        parts.append(f"    <lastmod>{lastmod}</lastmod>")
    parts.append(f"    <changefreq>{changefreq}</changefreq>")
    parts.append(f"    <priority>{priority}</priority>")
    parts.append("  </url>")
    return "\n".join(parts)


def sitemap_xml(request):
    base = _site_url()
    today = tz_now().date().isoformat()
    entries: list[str] = []

    # ── Statik sayfalar ────────────────────────────────────────────────────
    static_pages = [
        ("/",          "daily",  "1.0"),
        ("/videos",    "hourly", "0.9"),
        ("/creators",  "daily",  "0.7"),
        ("/live",      "hourly", "0.8"),
        ("/search",    "daily",  "0.6"),
    ]
    for path, freq, pri in static_pages:
        entries.append(_url_entry(f"{base}{path}", today, freq, pri))

    # ── Kategoriler ────────────────────────────────────────────────────────
    try:
        from apps.videos.models import Category
        cats = Category.objects.values("slug")
        for cat in cats:
            slug = cat["slug"]
            if slug:
                entries.append(_url_entry(f"{base}/category/{escape(slug)}", today, "weekly", "0.6"))
    except Exception:
        pass

    # ── Yayınlanmış videolar ───────────────────────────────────────────────
    try:
        from apps.videos.models import Video
        videos = (
            Video.objects
            .filter(is_published=True, moderation_status="approved")
            .exclude(type="live")
            .values("slug", "id", "updated_at")
            .order_by("-updated_at")[:50000]
        )
        for v in videos:
            identifier = v["slug"] or v["id"]
            if not identifier:
                continue
            lastmod = v["updated_at"].date().isoformat() if v["updated_at"] else today
            entries.append(_url_entry(f"{base}/videos/{escape(str(identifier))}", lastmod, "weekly", "0.8"))
    except Exception:
        pass

    # ── Özel sayfalar ──────────────────────────────────────────────────────
    try:
        from apps.videos.models import CustomPage
        pages = CustomPage.objects.filter(is_published=True).values("slug")
        for p in pages:
            slug = p["slug"]
            if slug:
                entries.append(_url_entry(f"{base}/page/{escape(slug)}", today, "monthly", "0.5"))
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


def robots_txt(request):
    base = _site_url()
    content = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /api/\n"
        "Disallow: /django-admin/\n"
        "Disallow: /admin\n"
        "\n"
        f"Sitemap: {base}/sitemap.xml\n"
    )
    return HttpResponse(content, content_type="text/plain; charset=utf-8")
