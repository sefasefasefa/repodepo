"""Management command: send the periodic visitor report email."""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Ziyaretçi özet e-postasını gönderir (cron/task runner ile çalıştırın)'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Zamanlama kontrolünü atla, hemen gönder')

    def handle(self, *args, **options):
        from apps.core.visitor_views import _get_report_settings, _send_visitor_report_now
        from django.utils import timezone
        from datetime import timedelta

        s = _get_report_settings()

        if not s.is_enabled and not options['force']:
            self.stdout.write('Rapor gönderimi devre dışı. --force ile zorla.')
            return

        if not s.recipients:
            self.stdout.write(self.style.WARNING('Alıcı listesi boş, atlanıyor.'))
            return

        if not options['force'] and s.last_sent:
            freq_delta = {'daily': timedelta(days=1), 'weekly': timedelta(days=7), 'monthly': timedelta(days=30)}
            delta = freq_delta.get(s.frequency, timedelta(days=7))
            if timezone.now() - s.last_sent < delta:
                self.stdout.write('Henüz zamanı gelmedi.')
                return

        ok, msg = _send_visitor_report_now(s)
        if ok:
            self.stdout.write(self.style.SUCCESS(f'✓ {msg}'))
        else:
            self.stdout.write(self.style.ERROR(f'✗ {msg}'))
