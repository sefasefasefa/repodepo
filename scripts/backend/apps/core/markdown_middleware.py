"""
Markdown for Agents Middleware
RFC 7231 content negotiation: Accept: text/markdown → HTML yanıtı Markdown'a dönüştürülür.
Browsers (Accept: text/html) etkilenmez.

SPA sayfalarında __HP_INIT__ JSON ve meta tag'leri kullanılarak anlamlı Markdown üretilir.
"""
import re
import json
import html2text as _h2t

_converter = _h2t.HTML2Text()
_converter.ignore_links = False
_converter.ignore_images = True
_converter.ignore_emphasis = False
_converter.body_width = 0
_converter.unicode_snob = True
_converter.skip_internal_links = True
_converter.single_line_break = True

_RE_TITLE    = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_RE_META_D   = re.compile(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']', re.IGNORECASE)
_RE_META_D2  = re.compile(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']description["\']', re.IGNORECASE)
_RE_OG_TITLE = re.compile(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']*)["\']', re.IGNORECASE)
_RE_OG_DESC  = re.compile(r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']*)["\']', re.IGNORECASE)
_RE_INIT     = re.compile(r'<script[^>]+id=["\']__HP_INIT__["\'][^>]*>(.*?)</script>', re.DOTALL)


def _accepts_markdown(request):
    accept = request.META.get("HTTP_ACCEPT", "")
    if "text/markdown" not in accept:
        return False
    md_q   = _extract_q(accept, "text/markdown")
    html_q = _extract_q(accept, "text/html")
    return md_q >= html_q


def _extract_q(accept_header, media_type):
    pattern = re.compile(
        r"(?:^|,)\s*" + re.escape(media_type) + r"(?:\s*;\s*q=([\d.]+))?",
        re.IGNORECASE,
    )
    m = pattern.search(accept_header)
    if not m:
        return 0.0
    return float(m.group(1)) if m.group(1) else 1.0


def _approx_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def _extract_meta(html: str) -> dict:
    """HTML'den title, description ve init JSON'unu çıkarır."""
    result = {}

    m = _RE_OG_TITLE.search(html) or _RE_TITLE.search(html)
    if m:
        result["title"] = m.group(1).strip()

    m = _RE_OG_DESC.search(html) or _RE_META_D.search(html) or _RE_META_D2.search(html)
    if m:
        result["description"] = m.group(1).strip()

    m = _RE_INIT.search(html)
    if m:
        try:
            result["init"] = json.loads(m.group(1))
        except Exception:
            pass

    return result


def _build_markdown_from_meta(meta: dict, path: str) -> str:
    """Extracted meta ve init verisinden anlamlı Markdown üretir."""
    lines = []

    title = meta.get("title", "Hotpulse")
    lines.append(f"# {title}\n")

    desc = meta.get("description", "")
    if desc:
        lines.append(f"{desc}\n")

    init = meta.get("init", {})
    site_config = init.get("siteConfig", {})
    site_desc = site_config.get("siteDescription", "")
    if site_desc and site_desc != desc:
        lines.append(f"{site_desc}\n")

    # Ana bağlantılar
    lines.append("## Ana Bölümler\n")
    lines.append("- [Ana Sayfa](/)")
    lines.append("- [Videolar](/videos)")
    lines.append("- [Kategoriler](/categories)")
    lines.append("- [Yayıncılar](/creators)")
    lines.append("- [Canlı Yayınlar](/live)")
    lines.append("- [Abonelik Planları](/pricing)")
    lines.append("- [Giriş Yap](/login)")
    lines.append("- [Kayıt Ol](/register)\n")

    # Öne çıkan videolar varsa
    home_data = init.get("homeData", {})
    featured = home_data.get("featured") or []
    if featured:
        lines.append("## Öne Çıkan İçerikler\n")
        for v in featured[:5]:
            v_title = v.get("title", "")
            v_slug = v.get("slug") or v.get("id", "")
            v_views = v.get("views", 0)
            if v_title and v_slug:
                lines.append(f"- [{v_title}](/videos/{v_slug}) — {v_views:,} izlenme")
        lines.append("")

    # Trending videolar
    trending = home_data.get("trending") or []
    if trending:
        lines.append("## Trend Videolar\n")
        for v in trending[:5]:
            v_title = v.get("title", "")
            v_slug = v.get("slug") or v.get("id", "")
            if v_title and v_slug:
                lines.append(f"- [{v_title}](/videos/{v_slug})")
        lines.append("")

    # Kategoriler
    cats = home_data.get("categories") or []
    if cats:
        lines.append("## Kategoriler\n")
        for c in cats[:10]:
            c_name = c.get("name", "")
            c_slug = c.get("slug") or c.get("id", "")
            if c_name:
                lines.append(f"- [{c_name}](/categories/{c_slug})")
        lines.append("")

    # API bilgisi
    lines.append("## API\n")
    lines.append("- **Katalog:** [/.well-known/api-catalog](/.well-known/api-catalog)")
    lines.append("- **Init:** [/api/init](/api/init)")
    lines.append("- **Sağlık:** [/api/healthz](/api/healthz)")
    lines.append("- **Sitemap:** [/sitemap.xml](/sitemap.xml)\n")

    return "\n".join(lines)


class MarkdownNegotiationMiddleware:
    """
    Accept: text/markdown ile gelen isteklerde HTML yanıtları Markdown'a çevirir.
    Yalnızca text/html Content-Type'lı yanıtlara uygulanır.
    API yanıtları, statik dosyalar ve yönlendirmeler etkilenmez.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if not _accepts_markdown(request):
            return response

        ct = response.get("Content-Type", "")
        if "text/html" not in ct:
            return response

        if response.status_code >= 400:
            return response

        try:
            html_content = response.content.decode("utf-8", errors="replace")
        except Exception:
            return response

        # Önce meta/init verisinden anlamlı Markdown dene
        meta = _extract_meta(html_content)
        if meta.get("title") or meta.get("init"):
            markdown_content = _build_markdown_from_meta(meta, request.path)
        else:
            # Fallback: html2text ile dönüştür
            try:
                markdown_content = _converter.handle(html_content).strip()
            except Exception:
                return response

        if not markdown_content:
            return response

        token_count = _approx_tokens(markdown_content)
        md_bytes    = markdown_content.encode("utf-8")

        response.content              = md_bytes
        response["Content-Type"]      = "text/markdown; charset=utf-8"
        response["Content-Length"]    = len(md_bytes)
        response["x-markdown-tokens"] = str(token_count)
        response["Vary"]              = "Accept"
        if "ETag" in response:
            del response["ETag"]

        return response
