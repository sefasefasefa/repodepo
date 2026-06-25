"""
Management command to seed initial data for Soci Django.
Run: python manage.py seed_data [--env=dev|prod]

SECURITY NOTE:
  In --env=prod mode (default), admin password is auto-generated and printed once.
  In --env=dev mode, predictable dev credentials are used (do NOT use in production).
"""
import secrets
import string
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


def _random_password(length=16):
    alphabet = string.ascii_letters + string.digits + '!@#$%^&*'
    return ''.join(secrets.choice(alphabet) for _ in range(length))


class Command(BaseCommand):
    help = 'Seed initial data (admin, categories, token packages, plans, feature flags)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--env',
            default='prod',
            choices=['dev', 'prod'],
            help='dev uses simple passwords; prod generates random credentials (default: prod)',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Re-run even if data already exists',
        )

    def handle(self, *args, **options):
        env = options['env']
        force = options['force']
        self.stdout.write(f'Seeding data (env={env})...')

        self._create_admin(env, force)
        self._create_categories(force)
        self._create_token_packages(force)
        self._create_subscription_plans(force)
        self._create_feature_flags(force)
        self._create_watermark_settings()
        self._create_site_settings()
        self._create_sample_creators(env, force)
        self._create_badge_definitions(force)
        self._create_sample_videos(env, force)

        self.stdout.write(self.style.SUCCESS('Seed data complete.'))
        if env == 'prod':
            self.stdout.write(self.style.WARNING(
                'IMPORTANT: Save the admin credentials printed above — '
                'they will not be shown again.'
            ))

    def _create_admin(self, env, force):
        if User.objects.filter(username='admin').exists() and not force:
            self.stdout.write('  Admin user already exists (skip)')
            return

        if env == 'dev':
            password = 'admin123'
            self.stdout.write(self.style.WARNING(
                '  [DEV] Admin user: username=admin  password=admin123  '
                '(NOT safe for production)'
            ))
        else:
            password = _random_password()
            self.stdout.write(self.style.SUCCESS(
                f'  Admin created: username=admin  password={password}'
            ))

        if User.objects.filter(username='admin').exists():
            admin = User.objects.get(username='admin')
        else:
            admin = User(
                username='admin',
                email='admin@soci.local',
                display_name='Site Yöneticisi',
                role='admin',
                is_staff=True,
                is_superuser=True,
                is_verified=True,
            )
        admin.set_password(password)
        admin.generate_session_token()
        admin.save()

    def _create_categories(self, force):
        from apps.videos.models import Category
        categories = [
            ('Eğlence', 'eglence', '🎭'),
            ('Müzik', 'muzik', '🎵'),
            ('Oyun', 'oyun', '🎮'),
            ('Spor', 'spor', '⚽'),
            ('Teknoloji', 'teknoloji', '💻'),
            ('Güzellik & Moda', 'guzellik-moda', '💄'),
            ('Yemek & Mutfak', 'yemek-mutfak', '🍳'),
            ('Seyahat', 'seyahat', '✈️'),
            ('Eğitim', 'egitim', '📚'),
            ('Yaşam Tarzı', 'yasam-tarzi', '🌟'),
            ('Haber & Gündem', 'haber', '📰'),
            ('Sanat & Tasarım', 'sanat', '🎨'),
            ('Fitness & Sağlık', 'fitness', '💪'),
            ('Komedi', 'komedi', '😂'),
            ('Yetişkin', 'yetiskin', '🔞'),
        ]
        count = 0
        for name, slug_val, icon in categories:
            if not Category.objects.filter(slug=slug_val).exists():
                Category.objects.create(name=name, slug=slug_val, icon_url=icon)
                count += 1
        if count:
            self.stdout.write(f'  Created {count} categories')

    def _create_token_packages(self, force):
        from apps.tokens.models import TokenPackage
        packages = [
            ('Başlangıç', 100, 0.99, 0, False),
            ('Popüler', 500, 4.99, 50, True),
            ('Değerli', 1000, 9.99, 150, False),
            ('Premium', 2500, 24.99, 500, False),
            ('Elit', 5000, 49.99, 1500, False),
        ]
        count = 0
        for name, tokens, price, bonus, popular in packages:
            if not TokenPackage.objects.filter(name=name).exists():
                TokenPackage.objects.create(
                    name=name, tokens=tokens, price_usd=price, bonus=bonus, is_popular=popular
                )
                count += 1
        if count:
            self.stdout.write(f'  Created {count} token packages')

    def _create_subscription_plans(self, force):
        from apps.subscriptions.models import SubscriptionPlan
        plans = [
            ('Ücretsiz', 'Temel özellikler', 0.00, 'monthly', [], False),
            ('Pro Aylık', 'Tüm premium içeriklere erişim', 9.99, 'monthly', [
                'Reklamsız izleme', 'Premium içerikler', 'HD kalite', '1 ay geçerli'
            ], False),
            ('Pro Yıllık', 'Yıllık abonelik - 2 ay bedava', 99.99, 'yearly', [
                'Reklamsız izleme', 'Premium içerikler', 'HD kalite', '4K kalite',
                'İndirme özelliği', '12 ay geçerli', '2 ay bedava'
            ], True),
        ]
        count = 0
        for name, desc, price, cycle, features, popular in plans:
            if not SubscriptionPlan.objects.filter(name=name).exists():
                SubscriptionPlan.objects.create(
                    name=name, description=desc, price=price,
                    billing_cycle=cycle, features=features, is_popular=popular
                )
                count += 1
        if count:
            self.stdout.write(f'  Created {count} subscription plans')

    def _create_feature_flags(self, force):
        from apps.core.models import FeatureFlag
        flags = [
            ('videos', 'Videolar', 'Video listeleri ve video sayfaları'),
            ('shorts', 'Shorts', 'Kısa video akışı'),
            ('live_streams', 'Canlı Yayınlar', 'Canlı yayın izleme ve başlatma'),
            ('live_chat', 'Canlı Sohbet', 'Canlı yayınlarda sohbet'),
            ('stories', 'Stories', 'Hikaye akışı'),
            ('search', 'Arama', 'Site içi arama'),
            ('categories', 'Kategoriler', 'Kategori sayfaları'),
            ('creators', 'Creatorlar', 'Creator listeleri'),
            ('playlists', 'Playlistler', 'Oynatma listeleri'),
            ('notifications', 'Bildirimler', 'Bildirim merkezi'),
            ('history', 'Geçmiş', 'İzleme geçmişi'),
            ('bookmarks', 'Kaydedilenler', 'Kayıtlı içerikler'),
            ('subscriptions', 'Abonelikler', 'Abonelik ekranı'),
            ('upload', 'Yükleme', 'Video yükleme ekranı'),
            ('dm_messages', 'Mesajlar', 'Özel mesajlaşma'),
            ('affiliate', 'Affiliate', 'Affiliate programı'),
            ('admin_panel', 'Admin Panel', 'Admin panel girişi'),
            ('creator_dashboard', 'Creator Dashboard', 'Creator paneli'),
            ('payments', 'Ödemeler', 'Ödeme sistemi'),
            ('voice_messages', 'Sesli Mesajlar', 'DM sesli mesaj'),
        ]
        count = 0
        for key, label, desc in flags:
            if not FeatureFlag.objects.filter(key=key).exists():
                FeatureFlag.objects.create(key=key, label=label, description=desc, state='enabled')
                count += 1
        if count:
            self.stdout.write(f'  Created {count} feature flags')

    def _create_watermark_settings(self):
        from apps.videos.models import WatermarkSettings
        WatermarkSettings.objects.get_or_create(
            id=1,
            defaults={'is_enabled': False, 'text': 'Soci', 'position': 'bottom-right', 'size': 'medium', 'opacity': 0.4}
        )

    def _create_site_settings(self):
        from apps.admin_panel.models import SiteSettings
        SiteSettings.objects.get_or_create(
            id=1,
            defaults={'site_name': 'Soci', 'site_description': 'Video streaming platform', 'primary_color': '#7c3aed'}
        )

    def _create_sample_creators(self, env, force):
        if env != 'dev':
            return
        creators = [
            ('creator1', 'creator1@soci.local', 'İlk Creator', 'Merhaba!'),
            ('creator2', 'creator2@soci.local', 'İkinci Creator', 'Video içerikleri.'),
        ]
        count = 0
        for username, email, display_name, bio in creators:
            if not User.objects.filter(username=username).exists():
                user = User(username=username, email=email, display_name=display_name, bio=bio, role='creator', is_verified=True)
                user.set_password('creator123')
                user.generate_session_token()
                user.save()
                count += 1
        if count:
            self.stdout.write(self.style.WARNING(
                f'  [DEV] Created {count} sample creators (password: creator123)'
            ))

    def _create_sample_videos(self, env, force):
        if env != 'dev':
            return
        from apps.videos.models import Video, Category, VideoPlayer
        if Video.objects.exists() and not force:
            return
        creators = list(User.objects.filter(role='creator')[:2])
        if not creators:
            return
        cats = list(Category.objects.all()[:6])
        if not cats:
            return
        # Public-domain Big Buck Bunny / Sintel test streams (Mux + Google sample)
        sample_videos = [
            ('Big Buck Bunny',         'Açık kaynak demo videosu.',                  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',         596),
            ('Elephant Dream',         'Blender Vakfı kısa filmi.',                  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',       'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',       653),
            ('For Bigger Blazes',      'Chromecast tanıtım kliplerinden.',           'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',      15),
            ('For Bigger Escape',      'Chromecast tanıtım kliplerinden.',           'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg',     15),
            ('For Bigger Fun',         'Chromecast tanıtım kliplerinden.',           'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',         'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerFun.jpg',         60),
            ('Sintel',                 'Blender Vakfı kısa filmi.',                  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',              'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg',               888),
        ]
        count = 0
        for i, (title, desc, url, thumb, duration) in enumerate(sample_videos):
            v = Video.objects.create(
                title=title, description=desc,
                thumbnail_url=thumb, video_url=url, duration=duration,
                creator=creators[i % len(creators)], category=cats[i % len(cats)],
                is_published=True, type='video',
                view_count=100 + i * 37, like_count=10 + i * 3,
                tags=['demo', 'örnek'],
            )
            # Add default video player source
            VideoPlayer.objects.create(video=v, label='MP4 Kaynak', embed_url=url, player_type='mp4', is_default=True)
            count += 1
        if count:
            self.stdout.write(self.style.WARNING(f'  [DEV] Created {count} sample videos'))

    def _create_badge_definitions(self, force):
        from apps.social.models import BadgeDefinition
        badges = [
            ('verified', 'Onaylı Creator', 'Onaylanmış içerik üreticisi', '✅', '#22c55e', 'verified', 1),
            ('rising-star', 'Yükselen Yıldız', '1000+ takipçi', '⭐', '#f59e0b', 'follower_count', 1000),
            ('popular', 'Popüler', '10000+ görüntülenme', '🔥', '#ef4444', 'view_count', 10000),
            ('pro-creator', 'Pro Creator', '50+ video', '🎬', '#7c3aed', 'video_count', 50),
            ('top-tipper', 'Cömert Destekçi', 'Token gönderdi', '💎', '#06b6d4', 'tip_given', 1),
        ]
        count = 0
        for slug_val, name, desc, icon, color, criteria, threshold in badges:
            if not BadgeDefinition.objects.filter(slug=slug_val).exists():
                BadgeDefinition.objects.create(
                    slug=slug_val, name=name, description=desc,
                    icon=icon, color=color, criteria=criteria, threshold=threshold,
                )
                count += 1
        if count:
            self.stdout.write(f'  Created {count} badge definitions')
