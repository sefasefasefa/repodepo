"""
Otomatik thumbnail (küçük resim) üretimi — ffmpeg tabanlı.

Kullanım:
    from apps.videos.thumbnail_utils import auto_generate_thumbnail
    auto_generate_thumbnail(video)   # Video nesnesi gerekli

Çalışma şekli:
  1. Video yerel dosyaysa (/media/uploads/…) → ffmpeg doğrudan dosyadan frame alır.
  2. Video URL'si bir HTTP/HTTPS adresi ise → ffmpeg stream üzerinden okur.
  3. Thumbnail, media/thumbnails/auto_<uuid>.jpg olarak kaydedilir.
  4. Video kaydının thumbnail_url alanı güncellenir.
  5. Zaten thumbnail_url varsa hiçbir şey yapmaz.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import uuid

from django.conf import settings


def _ffmpeg_bin() -> str:
    """ffmpeg yolunu döner."""
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
    Boş veya yerel dosya yolu ise None döner.
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


def _extract_frame(source: str, out_path: str, seek_seconds: float = 5.0) -> bool:
    """
    ffmpeg ile 'source' konumundan 'seek_seconds' saniyesindeki kareyi
    'out_path' PNG/JPEG olarak kaydeder.
    Kaynak yetersiz süredeyse 1. kareyi kullanır.
    Başarılıysa True, başarısızsa False döner.
    """
    ffmpeg = _ffmpeg_bin()
    # Önce tam seek pozisyonunda deneyelim
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
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            return False
    return False


def auto_generate_thumbnail(video) -> bool:
    """
    Video için otomatik thumbnail üretir.
    Zaten thumbnail varsa False döner ve hiçbir şey yapmaz.
    Başarılıysa True döner.
    """
    if video.thumbnail_url:
        return False  # Zaten var, dokunma

    video_url = video.video_url or video.hls_url or ""
    if not video_url:
        return False

    # HLS (.m3u8) için ffmpeg stream okuma dene
    is_hls = video_url.lower().endswith(".m3u8") or video_url.lower().endswith(".m3u")

    # Kaynak belirle: önce yerel dosya, sonra HTTP URL
    source = _local_path(video_url) if not is_hls else None
    if not source:
        source = _public_url(video_url)
    if not source:
        return False

    # Çıktı yolu
    thumb_dir = os.path.join(settings.MEDIA_ROOT, "thumbnails")
    os.makedirs(thumb_dir, exist_ok=True)
    out_name = f"auto_{uuid.uuid4().hex}.jpg"
    out_path = os.path.join(thumb_dir, out_name)

    success = _extract_frame(source, out_path, seek_seconds=5.0)
    if not success:
        # Geçici dosyayı temizle
        try:
            os.remove(out_path)
        except OSError:
            pass
        return False

    thumb_url = f"/media/thumbnails/{out_name}"
    try:
        from apps.videos.models import Video as _Video
        _Video.objects.filter(id=video.id).update(thumbnail_url=thumb_url)
        video.thumbnail_url = thumb_url
    except Exception:
        return False

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
