from django.core.management.base import BaseCommand
from apps.accounts.models import User


class Command(BaseCommand):
    help = 'Varsayılan admin kullanıcısının varlığını garantiler.'

    def handle(self, *args, **options):
        u, created = User.objects.update_or_create(
            username='admin',
            defaults=dict(
                email='admin@admin.com',
                role='admin',
                is_staff=True,
                is_superuser=True,
                is_active=True,
            ),
        )
        u.set_password('admin123')
        u.save()
        if created:
            self.stdout.write(self.style.SUCCESS('Admin kullanıcısı oluşturuldu: admin@admin.com'))
        else:
            self.stdout.write(self.style.SUCCESS('Admin kullanıcısı doğrulandı: admin@admin.com'))
