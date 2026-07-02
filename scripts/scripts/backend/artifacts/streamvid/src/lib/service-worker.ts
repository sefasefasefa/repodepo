/**
 * Service Worker kayıt + güncelleme yönetimi.
 * main.tsx'ten import edilir; yalnızca production'da aktif.
 */

export function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Yeni SW bulunduğunda arka planda güncelle
        reg.addEventListener("updatefound", () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener("statechange", () => {
            if (newSW.state === "installed" && navigator.serviceWorker.controller) {
              // Yeni sürüm hazır — sessizce bekle; kullanıcı sekmeyi kapatınca devreye girer
              console.info("[SW] Yeni sürüm hazır, bir sonraki açılışta aktif.");
            }
          });
        });

        // 30 dakikada bir eski cache girişlerini temizle
        const sendClean = () => {
          if (reg.active) reg.active.postMessage("CLEAN_OLD_CACHE");
        };
        setTimeout(sendClean, 60_000);
        setInterval(sendClean, 30 * 60_000);
      })
      .catch(() => {
        // SW kaydı başarısız olursa site çalışmaya devam eder
      });
  });
}
