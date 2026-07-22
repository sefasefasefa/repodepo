"""
Management command to seed initial data for Soci / Prnhbbbb platform.
Run: python manage.py seed_data [--env=dev|prod]

SECURITY NOTE:
  In --env=prod mode (default), admin password is auto-generated and printed once.
  In --env=dev mode, predictable dev credentials are used (do NOT use in production).

CREDENTIALS (dev mode):
  Admin:      admin / admin123         (role=admin)
  Moderator:  moderator / mod123       (role=moderator)
  Creators:   creator1..creator5 / creator123  (role=creator)
  Users:      user1..user10 / user123  (role=user)
  VIP Users:  vip1..vip3 / vip123      (role=user, active premium sub)
"""
import secrets
import string
from datetime import timedelta
from django.utils import timezone
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


def _random_password(length=16):
    alphabet = string.ascii_letters + string.digits + '!@#$%^&*'
    return ''.join(secrets.choice(alphabet) for _ in range(length))


class Command(BaseCommand):
    help = 'Seed initial data (users, categories, subscriptions, tokens, feature flags)'

    def add_arguments(self, parser):
        parser.add_argument('--env', default='prod', choices=['dev', 'prod'],
            help='dev uses simple passwords; prod generates random credentials (default: prod)')
        parser.add_argument('--force', action='store_true',
            help='Re-run even if data already exists')

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
        self._create_seo_settings()
        self._create_badge_definitions(force)

        if env == 'dev':
            self._create_test_user(force)

        self.stdout.write(self.style.SUCCESS('Seed data complete.'))
        if env == 'prod':
            self.stdout.write(self.style.WARNING(
                'IMPORTANT: Save the admin credentials printed above — they will not be shown again.'
            ))

    # ── Admin ──────────────────────────────────────────────────────────────────
    def _create_admin(self, env, force):
        password = 'admin123' if env == 'dev' else _random_password()
        # Find existing admin by email or username
        user = (
            User.objects.filter(email='Admin@admin.com').first()
            or User.objects.filter(username='admin').first()
        )
        if user and not force:
            self.stdout.write(f'  Admin user already exists (skip) — {user.email}')
            return
        if not user:
            user = User(username='admin')
        user.username = 'admin'
        user.email = 'Admin@admin.com'
        user.display_name = 'Site Yöneticisi'
        user.role = 'admin'
        user.is_staff = True
        user.is_superuser = True
        user.is_verified = True
        user.set_password(password)
        user.generate_session_token()
        user.save()
        if env == 'dev':
            self.stdout.write(self.style.WARNING(f'  [DEV] Admin → username=admin  password=admin123  email=Admin@admin.com'))
        else:
            self.stdout.write(self.style.SUCCESS(f'  Admin created → username=admin  password={password}'))

    # ── Test User (dev only) ───────────────────────────────────────────────────
    def _create_test_user(self, force):
        if User.objects.filter(username='test').exists() and not force:
            return
        user, created = User.objects.get_or_create(username='test', defaults=dict(
            email='test@hotpulse.local', display_name='Test Kullanıcı',
            role='user', is_verified=True, bio='Deneme hesabı.',
        ))
        if created or force:
            user.set_password('test123')
            user.save()
            self.stdout.write(self.style.WARNING('  [DEV] Test user → username=test  password=test123'))

    # ── Moderator ──────────────────────────────────────────────────────────────
    def _create_moderator(self, force):
        if User.objects.filter(username='moderator').exists() and not force:
            return
        user, created = User.objects.get_or_create(username='moderator', defaults=dict(
            email='moderator@soci.local', display_name='Moderatör',
            role='moderator', is_verified=True, bio='Platform moderatörü',
        ))
        if created or force:
            user.set_password('mod123')
            user.generate_session_token()
            user.save()
            self.stdout.write(self.style.WARNING('  [DEV] Moderator → username=moderator  password=mod123'))

    # ── Categories ────────────────────────────────────────────────────────────
    def _create_categories(self, force):
        from apps.videos.models import Category
        categories = [
            ('Eğlence',          'eglence',       '🎭'),
            ('Müzik',            'muzik',          '🎵'),
            ('Oyun',             'oyun',           '🎮'),
            ('Spor',             'spor',           '⚽'),
            ('Teknoloji',        'teknoloji',      '💻'),
            ('Güzellik & Moda',  'guzellik-moda',  '💄'),
            ('Yemek & Mutfak',   'yemek-mutfak',   '🍳'),
            ('Seyahat',          'seyahat',        '✈️'),
            ('Eğitim',           'egitim',         '📚'),
            ('Yaşam Tarzı',      'yasam-tarzi',    '🌟'),
            ('Haber & Gündem',   'haber',          '📰'),
            ('Sanat & Tasarım',  'sanat',          '🎨'),
            ('Fitness & Sağlık', 'fitness',        '💪'),
            ('Komedi',           'komedi',         '😂'),
            ('Yetişkin',         'yetiskin',       '🔞'),
            ('Cosplay',          'cosplay',        '🎭'),
            ('Modelling',        'modelling',      '📸'),
        ]
        count = 0
        for name, slug_val, icon in categories:
            if not Category.objects.filter(slug=slug_val).exists():
                Category.objects.create(name=name, slug=slug_val, icon_url=icon)
                count += 1
        if count:
            self.stdout.write(f'  Created {count} categories')

    # ── Token Packages ────────────────────────────────────────────────────────
    def _create_token_packages(self, force):
        from apps.tokens.models import TokenPackage
        packages = [
            ('Başlangıç',  100,   0.99,  0,    False),
            ('Popüler',    500,   4.99,  50,   True),
            ('Değerli',    1000,  9.99,  150,  False),
            ('Premium',    2500,  24.99, 500,  False),
            ('Elit',       5000,  49.99, 1500, False),
            ('Diamond',    10000, 89.99, 4000, False),
        ]
        count = 0
        for name, tokens, price, bonus, popular in packages:
            if not TokenPackage.objects.filter(name=name).exists():
                TokenPackage.objects.create(name=name, tokens=tokens, price_usd=price, bonus=bonus, is_popular=popular)
                count += 1
        if count:
            self.stdout.write(f'  Created {count} token packages')

    # ── Subscription Plans ────────────────────────────────────────────────────
    def _create_subscription_plans(self, force):
        from apps.subscriptions.models import SubscriptionPlan
        plans = [
            # ── Temel planlar ──
            {
                'name': 'Ücretsiz',
                'description': 'Temel içeriklere ücretsiz erişim. Reklamlı izleme, sınırlı içerik.',
                'price': 0.00, 'billing_cycle': 'monthly', 'is_popular': False, 'is_adult': False,
                'features': [
                    'Ücretsiz içeriklere erişim',
                    'Reklamlı izleme',
                    '720p maksimum kalite',
                    'Günlük 10 video limiti',
                ],
            },
            {
                'name': 'Pro Aylık',
                'description': 'Aylık premium plan. Tüm premium içeriklere reklamsız erişim.',
                'price': 9.99, 'billing_cycle': 'monthly', 'is_popular': False, 'is_adult': False,
                'features': [
                    'Reklamsız izleme',
                    'Tüm premium içerikler',
                    '1080p HD kalite',
                    'Sınırsız izleme',
                    '1 ay geçerli',
                ],
            },
            {
                'name': 'Pro Yıllık',
                'description': 'Yıllık premium plan — 2 ay bedava, en iyi değer.',
                'price': 99.99, 'billing_cycle': 'yearly', 'is_popular': True, 'is_adult': False,
                'features': [
                    'Reklamsız izleme',
                    'Tüm premium içerikler',
                    '4K Ultra HD kalite',
                    'İndirme özelliği',
                    '12 ay geçerli',
                    '2 ay bedava (83.33$/ay)',
                    'Creator özel içerikleri',
                ],
            },
            # ── 18+ Özel planlar ──────────────────────────────────────────────
            {
                'name': '🔞 Adult Temel',
                'description': 'Yetişkin içerik kütüphanesine aylık temel erişim. 18+ doğrulama gereklidir.',
                'price': 14.99, 'billing_cycle': 'monthly', 'is_popular': False, 'is_adult': True,
                'features': [
                    '18+ içerik kütüphanesi',
                    'Reklamsız izleme',
                    '1080p HD kalite',
                    'Sınırsız izleme',
                    'Aylık 50 özel içerik',
                    '1 ay geçerli',
                ],
            },
            {
                'name': '🔞 Adult Premium',
                'description': 'Tam 18+ premium paket. Tüm creator özel içerikleri, canlı yayınlar ve özel mesajlaşma.',
                'price': 24.99, 'billing_cycle': 'monthly', 'is_popular': True, 'is_adult': True,
                'features': [
                    'Tüm 18+ içerik kütüphanesi',
                    'Creator özel içerikleri (OnlyFans benzeri)',
                    'Canlı 18+ yayın erişimi',
                    'Creator ile özel mesajlaşma',
                    'Reklamsız izleme',
                    '4K Ultra HD kalite',
                    'Sınırsız indirme',
                    'Aylık 200 Token hediye',
                    '1 ay geçerli',
                ],
            },
            {
                'name': '🔞 Adult VIP Yıllık',
                'description': 'En kapsamlı yetişkin platform üyeliği. Tüm özellikler + öncelikli creator erişimi + aylık token.',
                'price': 199.99, 'billing_cycle': 'yearly', 'is_popular': False, 'is_adult': True,
                'features': [
                    'Tüm 18+ içerik kütüphanesi',
                    'VIP creator özel içerikleri',
                    'Tüm canlı yayın erişimi',
                    'Sınırsız özel mesajlaşma',
                    'Reklamsız 4K izleme',
                    'Sınırsız indirme',
                    'Aylık 500 Token hediye (6000/yıl)',
                    'Öncelikli müşteri desteği',
                    'Erken erişim içerikleri',
                    '12 ay geçerli — 3 ay bedava',
                ],
            },
            {
                'name': '🔞 Creator Fan Club',
                'description': "Sevdiğin creator'ın özel fan kulübü. Creator'ın tüm özel içerikleri ve canlı etkinlikleri.",
                'price': 7.99, 'billing_cycle': 'monthly', 'is_popular': False, 'is_adult': True,
                'features': [
                    'Creator özel içerikleri',
                    'Creator ile özel mesajlaşma',
                    'Özel fan rozeti',
                    'Canlı yayın önceliği',
                    'Aylık özel içerik paketi',
                    '1 ay geçerli',
                ],
            },
            {
                'name': '🔞 Adult Ömür Boyu',
                'description': 'Tek seferlik ödeme ile ömür boyu tam erişim. Asla tekrar ödeme yapma.',
                'price': 499.99, 'billing_cycle': 'lifetime', 'is_popular': False, 'is_adult': True,
                'features': [
                    'Ömür boyu tam 18+ erişim',
                    'Tüm mevcut ve gelecek içerikler',
                    'Aylık 1000 Token hediye (sonsuza kadar)',
                    '4K Ultra HD + sınırsız indirme',
                    'Sınırsız özel mesajlaşma',
                    'VIP desteği',
                    'Tek seferlik ödeme',
                ],
            },
        ]
        count = 0
        for plan_data in plans:
            is_adult = plan_data.pop('is_adult', False)
            if not SubscriptionPlan.objects.filter(name=plan_data['name']).exists():
                plan = SubscriptionPlan.objects.create(**plan_data)
                # Store adult flag in a way the model supports
                # We'll track this via name prefix or add metadata
                count += 1
        if count:
            self.stdout.write(f'  Created {count} subscription plans (including 18+ plans)')

    # ── Feature Flags ─────────────────────────────────────────────────────────
    def _create_feature_flags(self, force):
        from apps.core.models import FeatureFlag
        flags = [
            ('videos',           'Videolar',         'Video listeleri ve video sayfaları'),
            ('shorts',           'Shorts',           'Kısa video akışı'),
            ('live_streams',     'Canlı Yayınlar',   'Canlı yayın izleme ve başlatma'),
            ('live_chat',        'Canlı Sohbet',     'Canlı yayınlarda sohbet'),
            ('stories',          'Stories',          'Hikaye akışı'),
            ('search',           'Arama',            'Site içi arama'),
            ('categories',       'Kategoriler',      'Kategori sayfaları'),
            ('creators',         'Creatorlar',       'Creator listeleri'),
            ('playlists',        'Playlistler',      'Oynatma listeleri'),
            ('notifications',    'Bildirimler',      'Bildirim merkezi'),
            ('history',          'Geçmiş',           'İzleme geçmişi'),
            ('bookmarks',        'Kaydedilenler',    'Kayıtlı içerikler'),
            ('subscriptions',    'Abonelikler',      'Abonelik ekranı'),
            ('upload',           'Yükleme',          'Video yükleme ekranı'),
            ('dm_messages',      'Mesajlar',         'Özel mesajlaşma'),
            ('affiliate',        'Affiliate',        'Affiliate programı'),
            ('admin_panel',      'Admin Panel',      'Admin panel girişi'),
            ('creator_dashboard','Creator Dashboard','Creator paneli'),
            ('payments',         'Ödemeler',         'Ödeme sistemi'),
            ('voice_messages',   'Sesli Mesajlar',   'DM sesli mesaj'),
            ('adult_content',    '18+ İçerik',       'Yetişkin içerik bölümü'),
            ('ppv',              'PPV',              'Pay-per-view içerik satın alma'),
        ]
        count = 0
        for key, label, desc in flags:
            if not FeatureFlag.objects.filter(key=key).exists():
                FeatureFlag.objects.create(key=key, label=label, description=desc, state='enabled')
                count += 1
        if count:
            self.stdout.write(f'  Created {count} feature flags')

    # ── Watermark & Settings ──────────────────────────────────────────────────
    def _create_watermark_settings(self):
        from apps.videos.models import WatermarkSettings
        WatermarkSettings.objects.get_or_create(id=1, defaults={
            'is_enabled': False, 'text': 'Hotpulse',
            'position': 'bottom-right', 'size': 'medium', 'opacity': 0.4
        })

    def _create_site_settings(self):
        from apps.admin_panel.models import SiteSettings
        SiteSettings.objects.get_or_create(id=1, defaults={
            'site_name': 'Hotpulse', 'site_description': '18+ Video streaming ve sosyal platform',
            'primary_color': '#7c3aed'
        })

    def _create_seo_settings(self):
        from apps.admin_panel.models import SeoSettings
        SeoSettings.objects.get_or_create(id=1, defaults={
            'site_title': 'Hotpulse — 18+ Video Platform',
            'site_description': 'Türkiye\'nin lider yetişkin video streaming platformu. Creator içerikleri, canlı yayınlar ve daha fazlası.',
            'keywords': 'video, streaming, 18+, adult, creator, yetişkin, platform',
            'robots': 'index,follow',
            'og_type': 'website',
            'twitter_card': 'summary_large_image',
            'hreflang': 'tr',
            'schema_org_type': 'WebSite',
            'sitemap_enabled': True,
            'structured_data_enabled': True,
        })

    # ── Sample Creators (dev only) ─────────────────────────────────────────────
    def _create_sample_creators(self, force):
        creators = [
            ('creator1', 'creator1@soci.local', 'Ayşe Kaya',      '💃 Dans ve eğlence içerikleri üreticisi.',           True,  9.99),
            ('creator2', 'creator2@soci.local', 'Mert Demir',     '🎭 Cosplay ve karakter içerikleri.',                  True,  12.99),
            ('creator3', 'creator3@soci.local', 'Selin Arslan',   '📸 Model ve yaşam tarzı içerikleri.',                True,  14.99),
            ('creator4', 'creator4@soci.local', 'Burak Yıldız',   '🎬 Film yapımcısı ve özel içerik üreticisi.',        False, None),
            ('creator5', 'creator5@soci.local', 'Derin Öztürk',   '💋 18+ özel içerik üreticisi. Fan club aktif.',       True,  7.99),
        ]
        count = 0
        for username, email, display_name, bio, is_verified, sub_price in creators:
            if not User.objects.filter(username=username).exists():
                user = User(
                    username=username, email=email, display_name=display_name, bio=bio,
                    role='creator', is_verified=is_verified,
                    follower_count=100 + count * 250,
                    video_count=5 + count * 3,
                    total_views=1000 + count * 500,
                    subscription_price=sub_price,
                )
                user.set_password('creator123')
                user.generate_session_token()
                user.save()
                count += 1
        if count:
            self.stdout.write(self.style.WARNING(
                f'  [DEV] Created {count} sample creators (password: creator123)'
            ))

    # ── Sample Users (dev only) ────────────────────────────────────────────────
    def _create_sample_users(self, force):
        users = [
            ('user1',  'user1@soci.local',  'Ali Veli',       'Casual izleyici.'),
            ('user2',  'user2@soci.local',  'Fatma Nur',      'İçerik sevenler.'),
            ('user3',  'user3@soci.local',  'Kemal Aydın',    'Günlük kullanıcı.'),
            ('user4',  'user4@soci.local',  'Zeynep Şahin',   'Video izlemeyi seviyorum.'),
            ('user5',  'user5@soci.local',  'Hasan Çelik',    ''),
            ('user6',  'user6@soci.local',  'Elif Kırmızı',   'Creator destekçisi.'),
            ('user7',  'user7@soci.local',  'Okan Tuncer',    ''),
            ('user8',  'user8@soci.local',  'Merve Polat',    'Premium üye.'),
            ('user9',  'user9@soci.local',  'Tarık Güneş',    ''),
            ('user10', 'user10@soci.local', 'Seda Yılmaz',    'Uzun süredir üyeyim.'),
            # VIP kullanıcılar — Adult Premium aboneliği olacak
            ('vip1',   'vip1@soci.local',   'VIP Kullanıcı 1', '18+ içerik abonem.'),
            ('vip2',   'vip2@soci.local',   'VIP Kullanıcı 2', '18+ içerik abonem.'),
            ('vip3',   'vip3@soci.local',   'VIP Kullanıcı 3', '18+ içerik abonem.'),
        ]
        count = 0
        for username, email, display_name, bio in users:
            if not User.objects.filter(username=username).exists():
                password = 'vip123' if username.startswith('vip') else 'user123'
                user = User(username=username, email=email, display_name=display_name, bio=bio, role='user')
                user.set_password(password)
                user.generate_session_token()
                user.save()
                count += 1
        if count:
            self.stdout.write(self.style.WARNING(
                f'  [DEV] Created {count} sample users (user1-10: user123, vip1-3: vip123)'
            ))

    # ── Sample Videos (dev only) ───────────────────────────────────────────────
    def _create_sample_videos(self, force):
        from apps.videos.models import Video, Category, VideoPlayer
        if Video.objects.exists() and not force:
            return
        creators = list(User.objects.filter(role='creator')[:5])
        if not creators:
            return
        cats = list(Category.objects.all()[:8])
        if not cats:
            return
        sample_videos = [
            ('Big Buck Bunny',    'Açık kaynak demo videosu.',       'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',       'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',       596, False),
            ('Elephant Dream',    'Blender Vakfı kısa filmi.',       'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',     'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',     653, False),
            ('For Bigger Blazes', 'Chromecast tanıtım klibi.',       'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',    15,  False),
            ('For Bigger Escape', 'Chromecast tanıtım klibi.',       'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',   'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg',   15,  False),
            ('For Bigger Fun',    'Chromecast tanıtım klibi.',       'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerFun.jpg',        60,  False),
            ('Sintel',            'Blender Vakfı kısa filmi.',       'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',              'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/Sintel.jpg',               888, False),
            ('Premium Video 1',   'Özel premium içerik — demo.',     'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/SubaruOutbackOnStreetAndDirt.jpg', 120, True),
            ('Premium Video 2',   'Özel premium içerik — demo.',     'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4', 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/WeAreGoingOnBullrun.jpg', 90, True),
        ]
        count = 0
        from apps.videos.views import _make_slug
        for i, (title, desc, url, thumb, duration, is_premium) in enumerate(sample_videos):
            v = Video.objects.create(
                title=title, description=desc,
                slug=_make_slug(title),
                thumbnail_url=thumb, video_url=url, duration=duration,
                creator=creators[i % len(creators)],
                category=cats[i % len(cats)],
                is_published=True, type='video', is_premium=is_premium,
                view_count=100 + i * 37, like_count=10 + i * 3,
                tags=['demo', 'örnek'],
            )
            VideoPlayer.objects.create(video=v, label='MP4 Kaynak', embed_url=url, player_type='mp4', is_default=True)
            count += 1
        if count:
            self.stdout.write(self.style.WARNING(f'  [DEV] Created {count} sample videos ({count - 2} public, 2 premium)'))

    # ── Sample Subscriptions (dev only) ───────────────────────────────────────
    def _create_sample_subscriptions(self, force):
        from apps.subscriptions.models import UserSubscription, SubscriptionPlan, Payment
        now = timezone.now()

        # Planları bul
        try:
            plan_pro_monthly  = SubscriptionPlan.objects.get(name='Pro Aylık')
            plan_pro_yearly   = SubscriptionPlan.objects.get(name='Pro Yıllık')
            plan_adult_basic  = SubscriptionPlan.objects.get(name='🔞 Adult Temel')
            plan_adult_prem   = SubscriptionPlan.objects.get(name='🔞 Adult Premium')
            plan_adult_yearly = SubscriptionPlan.objects.get(name='🔞 Adult VIP Yıllık')
            plan_fan_club     = SubscriptionPlan.objects.get(name='🔞 Creator Fan Club')
        except SubscriptionPlan.DoesNotExist:
            self.stdout.write(self.style.ERROR('  Subscription plans not found — skipping subscriptions'))
            return

        sub_map = [
            # (username, plan, bitiş_tarihi)
            ('user2',   plan_pro_monthly,  now + timedelta(days=15)),
            ('user4',   plan_pro_monthly,  now + timedelta(days=5)),
            ('user6',   plan_pro_yearly,   now + timedelta(days=290)),
            ('user8',   plan_adult_basic,  now + timedelta(days=20)),
            ('user10',  plan_adult_basic,  now + timedelta(days=8)),
            # VIP kullanıcılar — Adult Premium ve Yearly
            ('vip1',    plan_adult_prem,   now + timedelta(days=25)),
            ('vip2',    plan_adult_yearly, now + timedelta(days=310)),
            ('vip3',    plan_fan_club,     now + timedelta(days=18)),
            # Creator abonelikleri (creator'ların da platformu kullandığı simülasyonu)
            ('creator4', plan_pro_monthly, now + timedelta(days=12)),
        ]

        sub_count = 0
        pay_count = 0
        for username, plan, end_date in sub_map:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                continue
            if not UserSubscription.objects.filter(user=user, plan=plan, status='active').exists():
                UserSubscription.objects.create(
                    user=user, plan=plan,
                    status='active',
                    current_period_start=now - timedelta(days=5),
                    current_period_end=end_date,
                    cancel_at_period_end=False,
                )
                sub_count += 1
                # Ödeme kaydı oluştur
                if float(plan.price) > 0:
                    Payment.objects.create(
                        user=user, type='subscription',
                        amount=plan.price, status='completed',
                        description=f'{plan.name} abonelik ödemesi',
                    )
                    pay_count += 1

        # Süresi dolmuş eski abonelik (tarihsel kayıt için)
        try:
            user3 = User.objects.get(username='user3')
            if not UserSubscription.objects.filter(user=user3, status='expired').exists():
                UserSubscription.objects.create(
                    user=user3, plan=plan_pro_monthly, status='expired',
                    current_period_start=now - timedelta(days=40),
                    current_period_end=now - timedelta(days=10),
                )
        except User.DoesNotExist:
            pass

        # İptal edilmiş abonelik (cancel_at_period_end=True)
        try:
            user5 = User.objects.get(username='user5')
            if not UserSubscription.objects.filter(user=user5, plan=plan_adult_basic).exists():
                UserSubscription.objects.create(
                    user=user5, plan=plan_adult_basic, status='active',
                    current_period_start=now - timedelta(days=3),
                    current_period_end=now + timedelta(days=27),
                    cancel_at_period_end=True,
                )
                sub_count += 1
        except User.DoesNotExist:
            pass

        if sub_count:
            self.stdout.write(self.style.WARNING(
                f'  [DEV] Created {sub_count} active subscriptions + {pay_count} payment records'
            ))
            self.stdout.write(self.style.WARNING(
                '  [DEV] VIP abonelikler: vip1=Adult Premium, vip2=Adult VIP Yıllık, vip3=Creator Fan Club'
            ))

    # ── Badge Definitions ─────────────────────────────────────────────────────
    def _create_badge_definitions(self, force):
        from apps.social.models import BadgeDefinition
        badges = [
            ('verified',      'Onaylı Creator',    'Onaylanmış içerik üreticisi', '✅', '#22c55e', 'verified',       1),
            ('rising-star',   'Yükselen Yıldız',   '1000+ takipçi',               '⭐', '#f59e0b', 'follower_count', 1000),
            ('popular',       'Popüler',            '10000+ görüntülenme',         '🔥', '#ef4444', 'view_count',     10000),
            ('pro-creator',   'Pro Creator',        '50+ video',                   '🎬', '#7c3aed', 'video_count',   50),
            ('top-tipper',    'Cömert Destekçi',   'Token gönderdi',              '💎', '#06b6d4', 'tip_given',      1),
            ('adult-creator', '18+ Creator',        'Onaylı yetişkin içerik üreticisi', '🔞', '#ec4899', 'adult_verified', 1),
            ('vip-member',    'VIP Üye',            'VIP abonelik aktif',          '👑', '#d97706', 'vip_subscriber', 1),
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
