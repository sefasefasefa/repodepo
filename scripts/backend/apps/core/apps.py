from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    verbose_name = 'Core'

    def ready(self):
        """
        Gunicorn preload_app=True ile master process'te bir kez çalışır.
        SEO ve Geo ayarlarını başlangıçta hafızaya alarak ilk isteği hızlandırır.
        """
        import threading
        threading.Thread(target=self._warm_caches, daemon=True).start()

    @staticmethod
    def _warm_caches():
        import time
        time.sleep(1)
        try:
            from apps.admin_panel.models import SeoSettings
            from apps.core.seo_views import _seo_cache
            s, _ = SeoSettings.objects.get_or_create(id=1)
            _seo_cache["obj"] = s
            _seo_cache["ts"] = time.monotonic()
        except Exception:
            pass

        try:
            from apps.core.models import GeoRestrictionSettings
            from django.core.cache import cache
            if not cache.get('geo_settings:v1'):
                g, _ = GeoRestrictionSettings.objects.get_or_create(id=1)
                cache.set('geo_settings:v1', {
                    'is_enabled': g.is_enabled,
                    'mode': g.mode,
                    'countries': g.countries or [],
                    'message': g.message,
                    'redirect_url': g.redirect_url,
                }, 300)
        except Exception:
            pass
