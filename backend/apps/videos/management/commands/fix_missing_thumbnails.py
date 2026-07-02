"""
fix_missing_thumbnails — Bozuk thumbnail kayıtlarını temizler ve yeniden üretir.

Çalışma mantığı:
  1. DB'de thumbnail_url dolu ama disk'te dosya olmayan videoları bulur.
  2. Bu videoların thumbnail_url'sini temizler (None yapar).
  3. Kaynak URL'si olan videolar için ffmpeg ile yeniden thumbnail üretir.
  4. Kaynak URL'si olmayan (tamamen URL'siz) videoları raporlar.

Kullanım:
  python manage.py fix_missing_thumbnails
  python manage.py fix_missing_thumbnails --dry-run   (sadece raporlar, değiştirmez)
  python manage.py fix_missing_thumbnails --async     (arka planda üretir)
"""

import os

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Disk'te olmayan thumbnail'ları temizler ve yeniden üretir."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Sadece raporla, değişiklik yapma.",
        )
        parser.add_argument(
            "--async",
            dest="use_async",
            action="store_true",
            help="Thumbnail üretimini arka plan thread'inde yap (hızlı döner).",
        )
        parser.add_argument(
            "--all",
            dest="all_missing",
            action="store_true",
            help="thumbnail_url boş olan tüm videoları da dahil et.",
        )

    def handle(self, *args, **options):
        from apps.videos.models import Video
        from apps.videos.thumbnail_utils import (
            _find_source_url,
            auto_generate_thumbnail,
            auto_generate_thumbnail_async,
        )

        dry_run = options["dry_run"]
        use_async = options["use_async"]
        include_all = options["all_missing"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY-RUN modu — değişiklik yapılmıyor."))

        # ── 1. Disk'te olmayan thumbnail'ları bul ──────────────────────────────
        broken = []
        videos_with_url = Video.objects.exclude(thumbnail_url__isnull=True).exclude(thumbnail_url="")
        for video in videos_with_url:
            thumb = video.thumbnail_url  # ör: /media/thumbnails/auto_abc123.jpg
            if not thumb:
                continue
            # Göreceli URL → mutlak disk yolu
            if thumb.startswith("/media/"):
                rel = thumb[len("/media/"):]
                disk_path = os.path.join(settings.MEDIA_ROOT, rel)
            elif os.path.isabs(thumb):
                disk_path = thumb
            else:
                disk_path = os.path.join(settings.MEDIA_ROOT, thumb)

            if not os.path.exists(disk_path):
                broken.append(video)

        self.stdout.write(f"Bozuk thumbnail (DB var, disk yok): {len(broken)} video")

        # ── 2. thumbnail_url boş olanları da dahil et (--all) ─────────────────
        no_thumb = []
        if include_all:
            no_thumb = list(
                Video.objects.filter(thumbnail_url__isnull=True) |
                Video.objects.filter(thumbnail_url="")
            )
            self.stdout.write(f"Thumbnail hiç yok: {len(no_thumb)} video")

        all_targets = broken + [v for v in no_thumb if v not in broken]

        if not all_targets:
            self.stdout.write(self.style.SUCCESS("Düzeltilecek video yok, her şey sağlıklı."))
            return

        # ── 3. Bozuk thumbnail_url'leri temizle ───────────────────────────────
        if not dry_run and broken:
            broken_ids = [v.id for v in broken]
            Video.objects.filter(id__in=broken_ids).update(thumbnail_url=None)
            self.stdout.write(f"  {len(broken_ids)} video thumbnail_url temizlendi.")

        # ── 4. Yeniden üret ────────────────────────────────────────────────────
        queued = 0
        skipped = 0
        for video in all_targets:
            # Modeli tazele (thumbnail_url=None oldu)
            video.thumbnail_url = None
            source = _find_source_url(video)
            if not source:
                skipped += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"  video_id={video.id} ({video.title[:40]}): kaynak URL yok, atlandı."
                    )
                )
                continue

            if dry_run:
                self.stdout.write(f"  [DRY] video_id={video.id}: yeniden üretilecek.")
                queued += 1
                continue

            if use_async:
                auto_generate_thumbnail_async(video)
            else:
                ok = auto_generate_thumbnail(video)
                if ok:
                    self.stdout.write(f"  video_id={video.id}: thumbnail üretildi.")
                else:
                    self.stdout.write(
                        self.style.WARNING(f"  video_id={video.id}: ffmpeg başarısız.")
                    )
            queued += 1

        # ── 5. Özet ───────────────────────────────────────────────────────────
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Tamamlandı: {queued} video {'kuyruğa alındı' if use_async else 'işlendi'}, "
                f"{skipped} video atlandı (kaynak URL yok)."
            )
        )
        if skipped > 0:
            self.stdout.write(
                "  Atlanan videolar için admin panelinden video_url veya crosspost URL tanımlayın."
            )
