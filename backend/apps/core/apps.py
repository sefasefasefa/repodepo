from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.core'
    verbose_name = 'Core'

    def ready(self):
        """
        Gunicorn preload_app=True ile master process'te bir kez çalışır.
        Senkron olarak çalışan kısım fork öncesi tamamlanır → tüm worker'lar
        hazır cache ile başlar (LocMemCache fork'ta kopyalanır).
        """
        # ── Senkron: fork öncesi çalışır, tüm worker'lara kopyalanır ─────────
        self._warm_init_cache()

        # ── Asenkron: SEO/Geo nesneleri — fork sonrası her worker kendi ──────
        import threading
        threading.Thread(target=self._warm_secondary_caches, daemon=True).start()

    @staticmethod
    def _warm_init_cache():
        """
        /api/init anon cache'i master process'te ısıtır.
        preload_app=True ile Gunicorn worker'lar fork'landığında bu veriyi miras alır.
        """
        try:
            from django.core.cache import cache
            from apps.core.views import _ANON_INIT_CACHE_KEY, _build_init_anon
            if not cache.get(_ANON_INIT_CACHE_KEY):
                result = _build_init_anon()
                cache.set(_ANON_INIT_CACHE_KEY, result, 300)
        except Exception:
            pass

    @staticmethod
    def _warm_secondary_caches():
        """SEO ve Geo nesnelerini her worker'da arka planda ısıtır."""
        import time
        time.sleep(0.5)

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
