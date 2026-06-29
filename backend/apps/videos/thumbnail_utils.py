"""
Otomatik thumbnail (küçük resim) üretimi — ffmpeg tabanlı.

Çalışma şekli:
  1. Video yerel dosyaysa (/media/uploads/…) → ffmpeg doğrudan dosyadan frame alır.
  2. Video URL'si bir HTTP/HTTPS adresi ise → ffmpeg stream üzerinden okur.
  3. Her iki yöntem de başarısız olursa crosspost job URL'leri denenir.
  4. Thumbnail, media/thumbnails/auto_<uuid>.jpg olarak kaydedilir.
  5. Video kaydının thumbnail_url alanı güncellenir.
  6. Zaten thumbnail_url varsa hiçbir şey yapmaz.
"""

from __future__ import annotations

import logging
import os
import shutil
import subprocess
import uuid

from django.conf import settings

logger = logging.getLogger(__name__)


def _ffmpeg_bin() -> str:
    path = shutil.which("ffmpeg")
    return path or "ffmpeg"


def _local_path(video_url: str) -> str | None:
    """
    /media/… biçimindeki URL'yi MEDIA_ROOT altındaki tam yola çevirir.
    Harici URL'ler için None döner.
    """
    if not video_url:
        return None
    if video_url.startswith("/media/"):
        rel = video_url[len("/media/"):]
        candidate = os.path.join(settings.MEDIA_ROOT, rel)
        return candidate if os.path.exists(candidate) else None
    return None


def _public_url(video_url: str) -> str | None:
    """
    Göreceli URL'yi SITE_URL ile tam adrese çevirir.
    http/https URL'lerini olduğu gibi döner.
    """
    if not video_url:
        return None
    if video_url.startswith("http://") or video_url.startswith("https://"):
        return video_url
    if video_url.startswith("/media/"):
        site_url = getattr(settings, "SITE_URL", "").rstrip("/")
        if site_url:
            return site_url + video_url
    return None


def _find_source_url(video) -> str | None:
    """
    Video için kullanılabilir bir kaynak URL bulur.
    Önce video_url/hls_url, yoksa crosspost job URL'lerini dener.
    """
    # 1. Doğrudan video_url veya hls_url
    direct = video.video_url or video.hls_url or ""
    if direct:
        local = _local_path(direct)
        if local:
            return local
        pub = _public_url(direct)
        if pub:
            return pub

    # 2. Crosspost job'larından stream URL bul
    try:
        from apps.crosspost.models import CrosspostJob
        jobs = CrosspostJob.objects.filter(
            video_id=video.id,
            status="done",
        ).exclude(stream_url="").exclude(stream_url__isnull=True)
        for job in jobs[:5]:
            url = job.stream_url
            if url and (url.startswith("http://") or url.startswith("https://")):
                return url
    except Exception:
        pass

    return None


def _extract_frame(source: str, out_path: str, seek_seconds: float = 5.0) -> bool:
    """
    ffmpeg ile 'source' konumundan 'seek_seconds' saniyesindeki kareyi
    'out_path' JPEG olarak kaydeder.
    Kaynak yetersiz süredeyse 1. kareyi kullanır.
    Başarılıysa True, başarısızsa False döner.
    """
    ffmpeg = _ffmpeg_bin()
    for seek in [seek_seconds, 1.0, 0.0]:
        cmd = [
            ffmpeg,
            "-y",
            "-ss", str(seek),
            "-i", source,
            "-vframes", "1",
            "-q:v", "3",
            "-vf", "scale='if(gt(iw,1280),1280,iw)':-2",
            out_path,
        ]
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=60,
            )
            if result.returncode == 0 and os.path.exists(out_path) and os.path.getsize(out_path) > 0:
                return True
        except subprocess.TimeoutExpired:
            logger.warning("ffmpeg thumbnail timeout: seek=%.1f src=%s", seek, source[:80])
            return False
        except (FileNotFoundError, OSError) as e:
            logger.error("ffmpeg bulunamadı veya OS hatası: %s", e)
            return False
        except Exception as e:
            logger.warning("ffmpeg beklenmedik hata: %s", e)
            continue
    return False


def auto_generate_thumbnail(video) -> bool:
    """
    Video için otomatik thumbnail üretir.
    Zaten thumbnail varsa False döner ve hiçbir şey yapmaz.
    Başarılıysa True döner.
    """
    if video.thumbnail_url:
        return False

    source = _find_source_url(video)
    if not source:
        logger.debug("Thumbnail üretilemedi: video_id=%s için kaynak URL bulunamadı", video.id)
        return False

    thumb_dir = os.path.join(settings.MEDIA_ROOT, "thumbnails")
    os.makedirs(thumb_dir, exist_ok=True)
    out_name = f"auto_{uuid.uuid4().hex}.jpg"
    out_path = os.path.join(thumb_dir, out_name)

    success = _extract_frame(source, out_path, seek_seconds=5.0)
    if not success:
        try:
            os.remove(out_path)
        except OSError:
            pass
        logger.debug("Thumbnail üretilemedi: video_id=%s src=%s", video.id, source[:80])
        return False

    thumb_url = f"/media/thumbnails/{out_name}"
    try:
        from apps.videos.models import Video as _Video
        _Video.objects.filter(id=video.id).update(thumbnail_url=thumb_url)
        video.thumbnail_url = thumb_url
    except Exception as e:
        logger.error("Thumbnail DB kaydı başarısız: video_id=%s hata=%s", video.id, e)
        return False

    logger.info("Thumbnail üretildi: video_id=%s -> %s", video.id, thumb_url)
    return True


def auto_generate_thumbnail_async(video) -> None:
    """
    auto_generate_thumbnail'i arka plan thread'inde çalıştırır.
    Video oluşturma akışını bloke etmemek için kullanılır.
    """
    import threading
    threading.Thread(
        target=auto_generate_thumbnail,
        args=(video,),
        daemon=True,
    ).start()
