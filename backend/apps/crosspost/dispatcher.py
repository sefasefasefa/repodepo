"""Cross-post dispatcher — gerçek API entegrasyonları ile.

Her host için ayrı bir adaptör fonksiyonu bulunur.
Ortak iki adım: (1) upload sunucu URL'si al, (2) dosyayı POST et.
"""
from __future__ import annotations

import os
import json
from typing import Iterable

from django.conf import settings
from django.utils import timezone

from .models import CrossPostJob, CrossPostSite

UA = "SociCrossPoster/2.0"


def _requests():
    try:
        import requests  # type: ignore
        return requests
    except Exception:
        return None


def _local_path(video) -> str | None:
    """video_url → absolute dosya yolu döner (yalnızca yerel dosyalar için)."""
    url = video.video_url or ""
    if url.startswith("/media/"):
        rel = url[len("/media/"):]
        return os.path.join(settings.MEDIA_ROOT, rel)
    return None


def dispatch_for_video(video, user, site_ids: Iterable[int] | None = None):
    qs = CrossPostSite.objects.filter(user=user, enabled=True)
    if site_ids is not None:
        site_ids = [int(s) for s in site_ids if str(s).isdigit()]
        qs = qs.filter(id__in=site_ids)
    else:
        qs = qs.filter(auto_post=True)

    jobs = []
    for site in qs:
        job = CrossPostJob.objects.create(user=user, site=site, video=video, status="pending")
        _run_job(job)
        jobs.append(job)
    return jobs


def _fail(job, msg: str):
    job.status = "failed"
    job.response_text = msg[:2000]
    job.finished_at = timezone.now()
    job.save()


def _success(job, remote_url: str = "", response_text: str = ""):
    job.status = "success"
    job.remote_url = remote_url[:500]
    job.response_text = response_text[:2000]
    job.finished_at = timezone.now()
    job.save()


def _run_job(job: CrossPostJob):
    job.status = "running"
    job.attempts = (job.attempts or 0) + 1
    job.save(update_fields=["status", "attempts"])

    site = job.site
    adapter = site.adapter

    if adapter == "manual":
        job.status = "skipped"
        job.response_text = "manuel mod — kullanıcı tarafından yapılacak"
        job.finished_at = timezone.now()
        job.save()
        return

    r = _requests()
    if r is None:
        return _fail(job, "requests kütüphanesi bulunamadı")

    fn = _ADAPTERS.get(adapter)
    if fn:
        fn(job, site, job.video, r)
    elif adapter == "multipart_form":
        _generic_multipart(job, site, job.video, r)
    else:
        _generic_webhook(job, site, job.video, r)


# ─────────────────────────────────────────────────────────────────────────────
# Ortak yardımcılar
# ─────────────────────────────────────────────────────────────────────────────

def _fxhosts_upload(job, site, video, r, server_url_fn, file_field="file"):
    """
    Pek çok host aynı 2-adımlı akışı kullanır:
      1. GET {server_url} → upload URL al
      2. POST dosyayı o URL'ye gönder
    server_url_fn(site) → str   upload server URL'sini döner.
    """
    try:
        server_url = server_url_fn(site)
        if not server_url:
            return _fail(job, "Upload server URL alınamadı")

        path = _local_path(video)
        if not path or not os.path.exists(path):
            return _fail(job, f"Dosya bulunamadı: {path}")

        with open(path, "rb") as f:
            resp = r.post(
                server_url,
                files={file_field: (os.path.basename(path), f, "video/mp4")},
                headers={"User-Agent": UA},
                timeout=3600,
            )
        job.response_code = resp.status_code
        if 200 <= resp.status_code < 300:
            try:
                rj = resp.json()
                remote_url = _extract_url(rj)
            except Exception:
                remote_url = ""
            _success(job, remote_url, resp.text)
        else:
            _fail(job, f"HTTP {resp.status_code}: {resp.text[:500]}")
    except Exception as exc:
        _fail(job, f"{type(exc).__name__}: {exc}")


def _extract_url(data) -> str:
    """Çeşitli API yanıtı formatlarından video URL'si çıkar."""
    if not isinstance(data, dict):
        return ""
    for k in ("url", "file_url", "filePage", "link", "embed_url", "result", "filelink"):
        v = data.get(k)
        if isinstance(v, str) and v.startswith("http"):
            return v
        if isinstance(v, dict):
            for k2 in ("url", "file_url", "link", "filePage"):
                v2 = v.get(k2)
                if isinstance(v2, str) and v2.startswith("http"):
                    return v2
    return ""


def _generic_webhook(job, site, video, r):
    if not site.upload_endpoint:
        return _fail(job, "upload_endpoint tanımsız")
    payload = {
        "title": video.title,
        "description": video.description or "",
        "videoUrl": video.video_url or "",
        "thumbnailUrl": video.thumbnail_url or "",
        "username": site.username,
        "apiKey": site.api_key,
    }
    hdrs = {"User-Agent": UA, "Content-Type": "application/json"}
    if isinstance(site.extra_headers, dict):
        hdrs.update({str(k): str(v) for k, v in site.extra_headers.items()})
    try:
        resp = r.post(site.upload_endpoint, data=json.dumps(payload), headers=hdrs, timeout=30)
        job.response_code = resp.status_code
        if 200 <= resp.status_code < 300:
            _success(job, "", resp.text)
        else:
            _fail(job, f"HTTP {resp.status_code}: {resp.text[:500]}")
    except Exception as exc:
        _fail(job, f"{type(exc).__name__}: {exc}")


def _generic_multipart(job, site, video, r):
    if not site.upload_endpoint:
        return _fail(job, "upload_endpoint tanımsız")
    path = _local_path(video)
    hdrs = {"User-Agent": UA}
    try:
        data = {"title": video.title, "apiKey": site.api_key, "username": site.username}
        if path and os.path.exists(path):
            with open(path, "rb") as f:
                resp = r.post(site.upload_endpoint, data=data,
                              files={"file": (os.path.basename(path), f, "video/mp4")},
                              headers=hdrs, timeout=3600)
        else:
            resp = r.post(site.upload_endpoint, data=data, headers=hdrs, timeout=30)
        job.response_code = resp.status_code
        if 200 <= resp.status_code < 300:
            _success(job, "", resp.text)
        else:
            _fail(job, f"HTTP {resp.status_code}: {resp.text[:500]}")
    except Exception as exc:
        _fail(job, f"{type(exc).__name__}: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# STREAMTAPE
# ─────────────────────────────────────────────────────────────────────────────
def _streamtape(job, site, video, r):
    login = site.username
    key = site.api_key or site.password
    if not login or not key:
        return _fail(job, "StreamTape: login ve API anahtarı gerekli")
    try:
        resp = r.get(
            "https://api.streamtape.com/file/ul",
            params={"login": login, "key": key},
            headers={"User-Agent": UA}, timeout=30,
        )
        data = resp.json()
        if data.get("status") != 200:
            return _fail(job, f"StreamTape upload URL hatası: {resp.text[:500]}")
        upload_url = data["result"]["url"]

        path = _local_path(video)
        if not path or not os.path.exists(path):
            return _fail(job, f"Dosya bulunamadı: {path}")

        with open(path, "rb") as f:
            up = r.post(upload_url, files={"file1": (os.path.basename(path), f, "video/mp4")},
                        headers={"User-Agent": UA}, timeout=3600)
        job.response_code = up.status_code
        ud = up.json()
        if ud.get("status") == 200:
            file_id = ud.get("result", "")
            remote = f"https://streamtape.com/v/{file_id}" if file_id else ""
            _success(job, remote, up.text)
        else:
            _fail(job, f"StreamTape yükleme hatası: {up.text[:500]}")
    except Exception as exc:
        _fail(job, f"StreamTape: {type(exc).__name__}: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# DOODSTREAM
# ─────────────────────────────────────────────────────────────────────────────
def _doodstream(job, site, video, r):
    key = site.api_key or site.password
    if not key:
        return _fail(job, "DoodStream: API anahtarı gerekli")
    try:
        resp = r.get("https://doodapi.com/api/upload/server", params={"key": key},
                     headers={"User-Agent": UA}, timeout=30)
        data = resp.json()
        if data.get("status") != 200:
            return _fail(job, f"DoodStream server hatası: {resp.text[:500]}")
        server = data["result"]

        path = _local_path(video)
        if not path or not os.path.exists(path):
            return _fail(job, f"Dosya bulunamadı: {path}")

        with open(path, "rb") as f:
            up = r.post(f"{server}?key={key}",
                        files={"file": (os.path.basename(path), f, "video/mp4")},
                        headers={"User-Agent": UA}, timeout=3600)
        job.response_code = up.status_code
        ud = up.json()
        if ud.get("status") == 200:
            remote = _extract_url(ud.get("result") or {})
            _success(job, remote, up.text)
        else:
            _fail(job, f"DoodStream yükleme hatası: {up.text[:500]}")
    except Exception as exc:
        _fail(job, f"DoodStream: {type(exc).__name__}: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# MIXDROP
# ─────────────────────────────────────────────────────────────────────────────
def _mixdrop(job, site, video, r):
    email = site.username
    key = site.api_key or site.password
    if not email or not key:
        return _fail(job, "Mixdrop: e-posta ve API anahtarı gerekli")

    path = _local_path(video)
    if not path or not os.path.exists(path):
        return _fail(job, f"Dosya bulunamadı: {path}")
    try:
        with open(path, "rb") as f:
            resp = r.post(
                "https://ul.mixdrop.ag/api",
                data={"email": email, "key": key},
                files={"file": (os.path.basename(path), f, "video/mp4")},
                headers={"User-Agent": UA}, timeout=3600,
            )
        job.response_code = resp.status_code
        rd = resp.json()
        if rd.get("result", {}).get("fileref"):
            fileref = rd["result"]["fileref"]
            _success(job, f"https://mixdrop.ag/e/{fileref}", resp.text)
        else:
            _fail(job, f"Mixdrop hatası: {resp.text[:500]}")
    except Exception as exc:
        _fail(job, f"Mixdrop: {type(exc).__name__}: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# VIDOZA
# ─────────────────────────────────────────────────────────────────────────────
def _vidoza(job, site, video, r):
    key = site.api_key or site.password
    if not key:
        return _fail(job, "Vidoza: API anahtarı gerekli")

    def server_fn(s):
        resp = r.get("https://vidoza.net/api/upload/",
                     params={"api_key": key}, headers={"User-Agent": UA}, timeout=30)
        d = resp.json()
        return d.get("result", {}).get("url") or d.get("url", "")

    try:
        server_url = server_fn(site)
        if not server_url:
            return _fail(job, "Vidoza upload server alınamadı")
        path = _local_path(video)
        if not path or not os.path.exists(path):
            return _fail(job, f"Dosya bulunamadı: {path}")
        with open(path, "rb") as f:
            resp = r.post(server_url,
                          data={"api_key": key},
                          files={"file": (os.path.basename(path), f, "video/mp4")},
                          headers={"User-Agent": UA}, timeout=3600)
        job.response_code = resp.status_code
        if 200 <= resp.status_code < 300:
            _success(job, _extract_url(resp.json() if resp.text else {}), resp.text)
        else:
            _fail(job, f"Vidoza yükleme hatası: {resp.text[:500]}")
    except Exception as exc:
        _fail(job, f"Vidoza: {type(exc).__name__}: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# Ortak "API anahtarı ile upload sunucu al → dosya POST et" adaptörü
# FileMoon, StreamWish, Voe, Upstream, VidHide, Luluvdo, StreamHide, SuperVideo
# Dropload, Embedsito, Vidlox, Streamlare, ClipWatching, StreamSB, HXFile,
# VidPlay, Nxbex, DropGalaxy, Evoload, Fembed, Hotlinking
# ─────────────────────────────────────────────────────────────────────────────
_API_KEY_HOSTS = {
    "filemoon":     "https://filemoonapi.com/api/upload/server",
    "streamwish":   "https://api.streamwish.com/api/upload/server",
    "voe":          "https://voe.sx/api/upload/server",
    "upstream":     "https://upstream.to/api/upload/server",
    "vidhide":      "https://vidhide.com/api/upload/server",
    "luluvdo":      "https://luluvdo.com/api/upload/server",
    "uqload":       "https://uqload.io/api/upload/server",
    "streamhide":   "https://streamhide.com/api/upload/server",
    "supervideo":   "https://supervideo.tv/api/upload/server",
    "dropload":     "https://dropload.io/api/upload/server",
    "embedsito":    "https://embedsito.com/api/upload/server",
    "vidlox":       "https://vidlox.me/api/upload/server",
    "streamlare":   "https://streamlare.com/api/upload/server",
    "clipwatching": "https://clipwatching.com/api/upload/server",
    "streamsb":     "https://streamsb.net/api/upload/server",
    "hxfile":       "https://hxfile.ch/api/upload/server",
    "vidplay":      "https://vidplay.online/api/upload/server",
    "nxbex":        "https://nxbex.com/api/upload/server",
    "dropgalaxy":   "https://dropgalaxy.com/api/upload/server",
    "evoload":      "https://evoload.io/api/upload/server",
    "fembed":       "https://www.fembed.com/api/upload/server",
    "hotlinking":   "https://hotlinking.co/api/upload/server",
}


def _make_api_key_adapter(provider_key: str):
    server_api = _API_KEY_HOSTS[provider_key]

    def _adapter(job, site, video, r):
        key = site.api_key or site.password
        if not key:
            return _fail(job, f"{provider_key}: API anahtarı gerekli")
        try:
            resp = r.get(server_api, params={"key": key},
                         headers={"User-Agent": UA}, timeout=30)
            d = resp.json()
            server_url = d.get("result") if isinstance(d.get("result"), str) else ""
            if not server_url:
                server_url = _extract_url(d)
            if not server_url:
                return _fail(job, f"{provider_key} upload server alınamadı: {resp.text[:300]}")

            path = _local_path(video)
            if not path or not os.path.exists(path):
                return _fail(job, f"Dosya bulunamadı: {path}")

            with open(path, "rb") as f:
                up = r.post(server_url,
                            files={"file": (os.path.basename(path), f, "video/mp4")},
                            headers={"User-Agent": UA}, timeout=3600)
            job.response_code = up.status_code
            if 200 <= up.status_code < 300:
                try:
                    ud = up.json()
                    remote = _extract_url(ud)
                except Exception:
                    remote = ""
                _success(job, remote, up.text)
            else:
                _fail(job, f"{provider_key} yükleme hatası: {up.text[:500]}")
        except Exception as exc:
            _fail(job, f"{provider_key}: {type(exc).__name__}: {exc}")

    return _adapter


# ─────────────────────────────────────────────────────────────────────────────
# Adapter tablosu
# ─────────────────────────────────────────────────────────────────────────────
_ADAPTERS = {
    "streamtape": _streamtape,
    "doodstream": _doodstream,
    "mixdrop":    _mixdrop,
    "vidoza":     _vidoza,
    **{k: _make_api_key_adapter(k) for k in _API_KEY_HOSTS},
}


# ─────────────────────────────────────────────────────────────────────────────
# Login testi
# ─────────────────────────────────────────────────────────────────────────────

_TEST_ENDPOINTS = {
    "streamtape":   lambda s: f"https://api.streamtape.com/account/info?login={s.username}&key={s.api_key or s.password}",
    "doodstream":   lambda s: f"https://doodapi.com/api/account/info?key={s.api_key or s.password}",
    "mixdrop":      lambda s: f"https://ul.mixdrop.ag/api/account?email={s.username}&key={s.api_key or s.password}",
    "vidoza":       lambda s: f"https://vidoza.net/api/account/info?api_key={s.api_key or s.password}",
    "filemoon":     lambda s: f"https://filemoonapi.com/api/account/info?key={s.api_key or s.password}",
    "streamwish":   lambda s: f"https://api.streamwish.com/api/account/info?key={s.api_key or s.password}",
    "voe":          lambda s: f"https://voe.sx/api/account/info?key={s.api_key or s.password}",
    "upstream":     lambda s: f"https://upstream.to/api/account/info?key={s.api_key or s.password}",
    "vidhide":      lambda s: f"https://vidhide.com/api/account/info?key={s.api_key or s.password}",
    "luluvdo":      lambda s: f"https://luluvdo.com/api/account/info?key={s.api_key or s.password}",
    "uqload":       lambda s: f"https://uqload.io/api/account/info?key={s.api_key or s.password}",
    "streamhide":   lambda s: f"https://streamhide.com/api/account/info?key={s.api_key or s.password}",
    "supervideo":   lambda s: f"https://supervideo.tv/api/account/info?key={s.api_key or s.password}",
    "dropload":     lambda s: f"https://dropload.io/api/account/info?key={s.api_key or s.password}",
    "embedsito":    lambda s: f"https://embedsito.com/api/account/info?key={s.api_key or s.password}",
    "vidlox":       lambda s: f"https://vidlox.me/api/account/info?key={s.api_key or s.password}",
    "streamlare":   lambda s: f"https://streamlare.com/api/account/info?key={s.api_key or s.password}",
    "clipwatching": lambda s: f"https://clipwatching.com/api/account/info?key={s.api_key or s.password}",
    "streamsb":     lambda s: f"https://streamsb.net/api/account/info?key={s.api_key or s.password}",
    "hxfile":       lambda s: f"https://hxfile.ch/api/account/info?key={s.api_key or s.password}",
    "vidplay":      lambda s: f"https://vidplay.online/api/account/info?key={s.api_key or s.password}",
    "nxbex":        lambda s: f"https://nxbex.com/api/account/info?key={s.api_key or s.password}",
    "dropgalaxy":   lambda s: f"https://dropgalaxy.com/api/account/info?key={s.api_key or s.password}",
    "evoload":      lambda s: f"https://evoload.io/api/account/info?key={s.api_key or s.password}",
    "fembed":       lambda s: f"https://www.fembed.com/api/account/info?key={s.api_key or s.password}",
    "hotlinking":   lambda s: f"https://hotlinking.co/api/account/info?key={s.api_key or s.password}",
}


def test_login(site: CrossPostSite) -> tuple[bool, str, int | None]:
    if site.adapter == "manual":
        return True, "manuel mod — login gerekmez", None
    r = _requests()
    if r is None:
        return False, "requests kütüphanesi yok", None

    fn = _TEST_ENDPOINTS.get(site.adapter)
    target = fn(site) if fn else (site.login_endpoint or site.base_url)
    if not target:
        return False, "login_endpoint veya base_url tanımsız", None

    try:
        resp = r.get(target, headers={"User-Agent": UA}, timeout=15)
        ok = 200 <= resp.status_code < 400
        try:
            d = resp.json()
            if isinstance(d, dict) and d.get("status") == 200:
                ok = True
            elif isinstance(d, dict) and d.get("status") not in (None, 200):
                ok = False
        except Exception:
            pass
        return ok, (resp.text or "")[:500], resp.status_code
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}", None
