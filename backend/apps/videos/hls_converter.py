"""
HLS dönüştürücü — yerel video dosyasını çoklu kalite seviyeli HLS'e çevirir.
ffmpeg 6+ gerektirir (Replit ortamında mevcut).
"""
import os
import subprocess
import threading
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

HLS_ROOT = os.path.join(settings.MEDIA_ROOT, 'hls')

# Oluşturulacak kalite seviyeleri
RENDITIONS = [
    {
        "name": "360p",
        "height": 360,
        "video_bitrate": "800k",
        "maxrate": "856k",
        "bufsize": "1200k",
        "audio_bitrate": "96k",
        "bandwidth": 1_000_000,
        "width_16_9": 640,
    },
    {
        "name": "720p",
        "height": 720,
        "video_bitrate": "2800k",
        "maxrate": "2996k",
        "bufsize": "4200k",
        "audio_bitrate": "128k",
        "bandwidth": 3_100_000,
        "width_16_9": 1280,
    },
    {
        "name": "1080p",
        "height": 1080,
        "video_bitrate": "5000k",
        "maxrate": "5350k",
        "bufsize": "7500k",
        "audio_bitrate": "192k",
        "bandwidth": 5_500_000,
        "width_16_9": 1920,
    },
]


def _probe_height(input_path: str) -> int:
    """ffprobe ile kaynak video yüksekliğini ölç."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-select_streams", "v:0",
                "-show_entries", "stream=height",
                "-of", "csv=p=0",
                input_path,
            ],
            capture_output=True, text=True, timeout=30,
        )
        return int(result.stdout.strip())
    except Exception:
        return 9999


def _probe_dimensions(input_path: str) -> tuple[int, int]:
    """ffprobe ile kaynak (genişlik, yükseklik) döndürür."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-select_streams", "v:0",
                "-show_entries", "stream=width,height",
                "-of", "csv=s=x:p=0",
                input_path,
            ],
            capture_output=True, text=True, timeout=30,
        )
        w, h = result.stdout.strip().split("x")
        return int(w), int(h)
    except Exception:
        return 1920, 1080


def _even(n: int) -> int:
    """En yakın çift sayıya yuvarla."""
    return n if n % 2 == 0 else n - 1


def _convert(video_db_id: int, input_path: str, video_uuid: str) -> None:
    """
    Dönüştürme iş mantığı — ayrı thread içinde çalışır.
    Tamamlandığında Video.hls_url ve hls_status güncellenir.
    """
    from .models import Video  # thread-safe import

    out_root = os.path.join(HLS_ROOT, video_uuid)
    os.makedirs(out_root, exist_ok=True)

    src_width, src_height = _probe_dimensions(input_path)
    logger.info("HLS başlıyor: video=%s kaynak=%dx%d", video_uuid, src_width, src_height)

    active = [r for r in RENDITIONS if r["height"] <= src_height]
    if not active:
        active = [RENDITIONS[0]]

    created = []

    for r in active:
        rend_dir = os.path.join(out_root, r["name"])
        os.makedirs(rend_dir, exist_ok=True)

        # Çıktı boyutu: -2:height → en boy oranını koru
        out_height = r["height"]
        out_width  = _even(round(src_width * out_height / src_height))

        cmd = [
            "ffmpeg", "-y", "-i", input_path,
            "-c:v", "libx264", "-preset", "fast", "-crf", "22",
            "-vf", f"scale={out_width}:{out_height}",
            "-b:v", r["video_bitrate"],
            "-maxrate", r["maxrate"],
            "-bufsize", r["bufsize"],
            "-c:a", "aac", "-b:a", r["audio_bitrate"], "-ac", "2",
            "-hls_time", "6",
            "-hls_playlist_type", "vod",
            "-hls_flags", "independent_segments",
            "-hls_segment_filename", os.path.join(rend_dir, "seg%04d.ts"),
            os.path.join(rend_dir, "index.m3u8"),
        ]

        try:
            proc = subprocess.run(cmd, capture_output=True, timeout=7200)
            if proc.returncode == 0:
                created.append((r, out_width, out_height))
                logger.info("HLS rendition hazır: %s / %s", video_uuid, r["name"])
            else:
                logger.error(
                    "ffmpeg hatası [%s/%s]: %s",
                    video_uuid, r["name"],
                    proc.stderr.decode(errors="replace")[-600:],
                )
        except subprocess.TimeoutExpired:
            logger.error("ffmpeg zaman aşımı: %s / %s", video_uuid, r["name"])
        except Exception as exc:
            logger.error("ffmpeg exception: %s / %s — %s", video_uuid, r["name"], exc)

    if not created:
        Video.objects.filter(id=video_db_id).update(hls_status="failed")
        logger.error("HLS başarısız (tüm seviyeler): %s", video_uuid)
        return

    # Master playlist yaz
    master_path = os.path.join(out_root, "master.m3u8")
    with open(master_path, "w") as f:
        f.write("#EXTM3U\n")
        f.write("#EXT-X-VERSION:3\n\n")
        for r, ow, oh in created:
            f.write(
                f'#EXT-X-STREAM-INF:BANDWIDTH={r["bandwidth"]},'
                f'RESOLUTION={ow}x{oh},'
                f'CODECS="avc1.42E01E,mp4a.40.2"\n'
            )
            f.write(f'{r["name"]}/index.m3u8\n')

    hls_url = f"/media/hls/{video_uuid}/master.m3u8"
    Video.objects.filter(id=video_db_id).update(hls_url=hls_url, hls_status="ready")
    logger.info("HLS tamamlandı: %s → %s", video_uuid, hls_url)


def start_hls_conversion(video_db_id: int, input_path: str, video_uuid: str) -> None:
    """
    HLS dönüştürmeyi arka plan thread'inde başlatır.
    Hemen döner; video.hls_status = 'processing' olarak güncellenir.
    """
    from .models import Video

    if not os.path.isfile(input_path):
        logger.warning("HLS başlatılamadı, dosya yok: %s", input_path)
        return

    Video.objects.filter(id=video_db_id).update(hls_status="processing")

    t = threading.Thread(
        target=_convert,
        args=(video_db_id, input_path, video_uuid),
        daemon=True,
        name=f"hls-{video_uuid[:8]}",
    )
    t.start()
    logger.info("HLS thread başlatıldı: %s", video_uuid)
