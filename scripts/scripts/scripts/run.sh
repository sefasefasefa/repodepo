#!/bin/bash
set -e

cd backend

MIGRATION_MARKER=".migration_done"

# Yeni migration dosyası varsa veya hiç çalışmadıysa migrate et
MIGRATION_HASH=$(find apps -name "*.py" -path "*/migrations/*" 2>/dev/null | sort | xargs md5sum 2>/dev/null | md5sum | cut -d' ' -f1)

if [ ! -f "$MIGRATION_MARKER" ] || [ "$(cat $MIGRATION_MARKER 2>/dev/null)" != "$MIGRATION_HASH" ]; then
  echo "Applying migrations..."
  python manage.py migrate --run-syncdb --no-input
  echo "$MIGRATION_HASH" > "$MIGRATION_MARKER"
else
  echo "Migrations up to date, skipping."
fi

# Veritabanı boşsa (ilk kurulum) temel seed datayı yükle
CATEGORY_COUNT=$(python manage.py shell -c "from apps.videos.models import Category; print(Category.objects.count())" 2>/dev/null | tail -1)
if [ "$CATEGORY_COUNT" = "0" ] || [ -z "$CATEGORY_COUNT" ]; then
  echo "Veritabanı boş — temel seed data yükleniyor..."
  python manage.py seed_data --env=prod 2>&1 | grep -v "^80 objects"
fi

# Cache temizle (eski boş cache sorununu önle)
python manage.py shell -c "from django.core.cache import cache; cache.clear()" 2>/dev/null | grep -v "^80 objects" || true

# ── index.html patcher: kritik preload hint'leri ve 18+ gate ekler ────────────
patch_index_html() {
  python3 - <<'PYEOF'
import os, re

html_path = 'static/index.html'
assets_dir = 'static/assets'

if not os.path.exists(html_path):
    print("patch_index_html: static/index.html bulunamadı, atlandı.")
    exit(0)

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# ── 1. CSS'i non-render-blocking yap (en kritik mobil hız optimizasyonu) ────
# <link rel="stylesheet"> render'ı bloklar → preload trick ile anında render
css_block_pattern = r'<link rel="stylesheet" crossorigin href="([^"]+)">'
css_match = re.search(css_block_pattern, html)
if css_match:
    href = css_match.group(1)
    old_css = css_match.group(0)
    new_css = (
        f'<link rel="preload" as="style" crossorigin href="{href}" '
        f'onload="this.rel=\'stylesheet\';this.onload=null">\n'
        f'    <noscript><link rel="stylesheet" crossorigin href="{href}"></noscript>'
    )
    html = html.replace(old_css, new_css, 1)

# ── 2. Kritik lazy chunk'lara modulepreload ekle ────────────────────────────
critical_patterns = ['home-', 'app-layout-', 'video-card-', 'categories-', 'ui-radix-']
new_preloads = []
if os.path.exists(assets_dir):
    existing = set(re.findall(r'href="/assets/([^"]+)"', html))
    for fname in sorted(os.listdir(assets_dir)):
        if fname.endswith('.js') and any(fname.startswith(p) for p in critical_patterns):
            if fname not in existing:
                new_preloads.append(f'    <link rel="modulepreload" crossorigin href="/assets/{fname}">')
if new_preloads:
    html = html.replace('  </head>', '\n'.join(new_preloads) + '\n  </head>', 1)

# ── 3. Inline 18+ gate + mining banner script yoksa ekle ────────────────────
GATE_MARKER = 'hp-age-yes'
MINING_MARKER = 'hp-mining'
SHELL_OBSERVER = 'React mount olunca app-shell'

# Eğer script bloğu yoksa, </body>'den önce ekle
gate_script = r"""
    <script>
    // ── ANLIK 18+ GATE — React parse edilmeden önce çalışır (0ms gecikme) ─────
    (function(){
      try{
        var AGE='prnhbbbb_age_verified', DENY='prnhbbbb_age_denied';
        var path=window.location.pathname;
        if(['/login','/register'].some(function(p){return path===p||path.indexOf(p+'?')===0;})) return;
        var verified=localStorage.getItem(AGE)==='1';
        var denied=localStorage.getItem(DENY)==='1';
        if(verified) return;
        var shell=document.getElementById('app-shell');
        if(!shell) return;
        var C='position:fixed;inset:0;background:#0a0a0a;display:flex;align-items:center;justify-content:center;padding:20px';
        if(denied){
          shell.innerHTML='<div style="'+C+'"><div style="text-align:center;max-width:360px">'+
            '<div style="width:64px;height:64px;background:rgba(220,38,38,.18);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">'+
              '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'+
            '</div>'+
            '<h2 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 10px">Erişim Kısıtlandı</h2>'+
            '<p style="color:#888;font-size:14px;line-height:1.6;margin:0 0 24px">Bu platform yalnızca 18 yaş ve üzeri kişilere yöneliktir.</p>'+
            '<button onclick="localStorage.removeItem(\'prnhbbbb_age_denied\');window.location.reload()" style="background:none;border:none;color:#555;font-size:12px;cursor:pointer;text-decoration:underline">Yaşımı yanlış girdim, tekrar dene</button>'+
          '</div></div>';
          return;
        }
        shell.innerHTML='<div style="'+C+'">'+
          '<div style="background:#141414;border:1px solid #2a2a2a;border-radius:20px;max-width:440px;width:100%;padding:32px;box-shadow:0 32px 64px rgba(0,0,0,.85)">'+
            '<div style="text-align:center;margin-bottom:28px">'+
              '<div style="width:56px;height:56px;background:#7c3aed;border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">'+
                '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'+
              '</div>'+
              '<h1 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 4px">Hotpulse</h1>'+
              '<p style="color:#666;font-size:11px;text-transform:uppercase;letter-spacing:.12em;margin:0">18+ Platform</p>'+
            '</div>'+
            '<div style="background:rgba(120,70,0,.18);border:1px solid rgba(180,110,0,.35);border-radius:12px;padding:14px 16px;margin-bottom:22px;display:flex;gap:12px;align-items:flex-start">'+
              '<svg style="flex-shrink:0;margin-top:1px" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'+
              '<div>'+
                '<p style="color:#fde68a;font-size:13px;font-weight:600;margin:0 0 4px">Yetişkin İçerik Uyarısı</p>'+
                '<p style="color:rgba(253,230,138,.65);font-size:12px;line-height:1.5;margin:0">Bu platform, 18 yaş ve üzeri yetişkinlere yönelik içerikler barındırmaktadır. Devam etmeden önce yaşınızı doğrulamanız gerekmektedir.</p>'+
              '</div>'+
            '</div>'+
            '<p style="text-align:center;color:#fff;font-weight:600;font-size:17px;margin:0 0 20px">18 yaşında veya daha büyük müsünüz?</p>'+
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:22px">'+
              '<button id="hp-age-yes" style="background:#7c3aed;color:#fff;font-weight:700;padding:14px 10px;border:none;border-radius:12px;cursor:pointer;font-size:13px;line-height:1.3">Evet, 18 yaşındayım veya daha büyüğüm</button>'+
              '<button id="hp-age-no" style="background:#1e1e1e;color:#aaa;padding:14px 10px;border:1px solid #333;border-radius:12px;cursor:pointer;font-size:13px;line-height:1.3">Hayır, 18 yaşından küçüğüm</button>'+
            '</div>'+
            '<div style="border-top:1px solid #1f1f1f;padding-top:16px;text-align:center">'+
              '<p style="color:#555;font-size:10px;line-height:1.6;margin:0 0 4px">Giriş yaparak bu sitenin Kullanım Koşulları\'nı ve Gizlilik Politikası\'nı okuduğunuzu kabul ediyorsunuz.</p>'+
              '<p style="color:#3a3a3a;font-size:10px;margin:6px 0 0">© Hotpulse. Tüm hakları saklıdır. 18+ Platform.</p>'+
            '</div>'+
          '</div>'+
        '</div>';
        document.getElementById('hp-age-yes').onclick=function(){
          localStorage.setItem(AGE,'1'); localStorage.removeItem(DENY);
          shell.innerHTML='<div style="position:fixed;inset:0;background:#0a0a0a;display:flex;align-items:center;justify-content:center">'+
            '<div style="width:36px;height:36px;border-radius:50%;border:3px solid #7c3aed;border-top-color:transparent;animation:spin .7s linear infinite"></div>'+
          '</div>';
        };
        document.getElementById('hp-age-no').onclick=function(){
          localStorage.setItem(DENY,'1'); localStorage.removeItem(AGE); window.location.reload();
        };
      }catch(e){}
    })();
    (function(){
      try{
        var AGE='prnhbbbb_age_verified', MC='prnhbbbb_mining_consent', ME='prnhbbbb_mining_enabled';
        var path=window.location.pathname;
        if(['/login','/register'].some(function(p){return path===p||path.indexOf(p+'?')===0;})) return;
        if(localStorage.getItem(AGE)!=='1') return;
        if(localStorage.getItem(MC)) return;
        var b=document.createElement('div');
        b.id='hp-mining';
        b.style.cssText='position:fixed;bottom:0;left:0;right:0;z-index:9998;padding:12px 16px;display:flex;justify-content:center;pointer-events:none';
        b.innerHTML='<div style="background:#1a1a1a;border:1px solid #2d2d2d;border-radius:18px;max-width:480px;width:100%;pointer-events:auto;overflow:hidden;box-shadow:0 -8px 40px rgba(0,0,0,.7)">'+
          '<div style="height:2px;background:linear-gradient(90deg,#ea580c,#facc15,#ea580c)"></div>'+
          '<div style="padding:14px 16px"><div style="display:flex;align-items:flex-start;gap:12px">'+
            '<div style="background:rgba(120,50,0,.35);border-radius:10px;padding:8px;flex-shrink:0">'+
              '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+
            '</div>'+
            '<div style="flex:1;min-width:0">'+
              '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">'+
                '<p style="color:#fff;font-weight:700;font-size:13px;margin:0">Bize Destek Olur musun?</p>'+
                '<button id="hp-m-close" style="background:none;border:none;color:#555;cursor:pointer;padding:0">'+
                  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'+
                '</button>'+
              '</div>'+
              '<p style="color:rgba(253,186,116,.75);font-size:11px;line-height:1.5;margin:8px 0">Bu platform tamamen <strong style="color:#fdba74">reklamsız ve ücretsiz</strong> çalışmaktadır. Sunucu masraflarını karşılamak için tarayıcının boşta kalan CPU\'sunu kullanarak bize destek olabilirsin.</p>'+
              '<div style="display:flex;gap:8px;margin-top:8px">'+
                '<button id="hp-m-yes" style="flex:1;background:#ea580c;color:#fff;font-weight:700;font-size:12px;padding:9px;border:none;border-radius:10px;cursor:pointer">Evet, destek olmak istiyorum!</button>'+
                '<button id="hp-m-no" style="flex:1;color:#666;font-size:12px;padding:9px;background:none;border:1px solid #2a2a2a;border-radius:10px;cursor:pointer">Hayır, teşekkürler</button>'+
              '</div>'+
            '</div>'+
          '</div></div></div>';
        document.body.appendChild(b);
        function hideMining(){if(b&&b.parentNode){b.style.opacity='0';b.style.transition='opacity .2s';setTimeout(function(){b.remove();},220);}}
        document.getElementById('hp-m-yes').onclick=function(){localStorage.setItem(MC,'yes');localStorage.setItem(ME,'yes');hideMining();};
        document.getElementById('hp-m-no').onclick=function(){localStorage.setItem(MC,'no');hideMining();};
        document.getElementById('hp-m-close').onclick=function(){localStorage.setItem(MC,'no');hideMining();};
        window.__hp_remove_mining=hideMining;
      }catch(e){}
    })();
    (function(){
      var mo=new MutationObserver(function(){
        var root=document.getElementById('root');
        if(root&&root.firstChild){
          var shell=document.getElementById('app-shell');
          if(shell){shell.classList.add('hidden');setTimeout(function(){shell.remove();},300);}
          if(typeof window.__hp_remove_mining==='function') window.__hp_remove_mining();
          mo.disconnect();
        }
      });
      var r=document.getElementById('root');
      if(r) mo.observe(r,{childList:true});
    })();
    </script>"""

if GATE_MARKER not in html:
    html = html.replace('</body>', gate_script + '\n  </body>', 1)

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

added = len(new_preloads)
gated = GATE_MARKER not in open(html_path).read() or True
print(f"index.html güncellendi: {added} preload hint eklendi, gate/mining script mevcut.")
PYEOF
}

# Frontend build hash'ini dist/public'ten hesapla (static/'ten değil)
# Böylece collectstatic --clear sonrası tekrar tetiklenmez
STATIC_MARKER=".static_done"
DIST_DIR="artifacts/streamvid/dist/public"

if [ -d "$DIST_DIR" ]; then
  STATIC_HASH=$(find "$DIST_DIR" -name "*.js" -o -name "*.css" 2>/dev/null | sort | xargs md5sum 2>/dev/null | md5sum | cut -d' ' -f1)
else
  STATIC_HASH="no-dist"
fi

if [ ! -f "$STATIC_MARKER" ] || [ "$(cat $STATIC_MARKER 2>/dev/null)" != "$STATIC_HASH" ]; then
  echo "Collecting and compressing static files..."
  # 1. Django uygulamalarının static dosyalarını topla (admin, rest_framework vb.)
  python manage.py collectstatic --clear --noinput -v 0
  # 2. Frontend build çıktısını static/'e kopyala (collectstatic --clear sonrası)
  if [ -d "$DIST_DIR" ]; then
    cp -r "$DIST_DIR/." static/
    echo "Frontend build dosyaları kopyalandı."
  fi
  # 3. index.html'e kritik preload + 18+ gate + mining banner ekle
  patch_index_html
  echo "$STATIC_HASH" > "$STATIC_MARKER"
else
  # Hash aynı ama index.html yoksa (ilk kurulum edge case) yine kopyala
  if [ ! -f "static/index.html" ] && [ -d "$DIST_DIR" ]; then
    cp -r "$DIST_DIR/." static/
    echo "Frontend build dosyaları (recovery) kopyalandı."
    patch_index_html
  else
    echo "Static files up to date, skipping."
  fi
fi

echo "Starting Django + Gunicorn on port 5000..."
exec gunicorn config.wsgi:application --config gunicorn.conf.py
