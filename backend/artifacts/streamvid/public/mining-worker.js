// WebWorker: Proof-of-Work madenci
// Monero-benzeri basit SHA-256 tabanlı hash döngüsü

let running = false;
let intensity = 50; // 0-100
let hashCount = 0;
let startTime = Date.now();

async function sha256(data) {
  const encoded = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function mine() {
  let nonce = Math.floor(Math.random() * 1e9);
  const jobId = Math.random().toString(36).substring(2);

  while (running) {
    const data = `prnhbbbb:${jobId}:${nonce}:${Date.now()}`;
    const hash = await sha256(data);
    hashCount++;
    nonce++;

    // Yoğunluğa göre dinlenme süresi (düşük yoğunluk = daha fazla bekleme)
    const pauseMs = Math.floor((100 - intensity) * 0.8);
    if (pauseMs > 0 && nonce % 10 === 0) {
      await sleep(pauseMs);
    }

    // Her 500 hash'te stats gönder
    if (hashCount % 500 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const hashRate = hashCount / elapsed;
      self.postMessage({ type: "stats", hashCount, hashRate: hashRate.toFixed(1), elapsed: elapsed.toFixed(0) });
    }

    if (!running) break;
  }
}

self.onmessage = function(e) {
  const { cmd, value } = e.data;

  if (cmd === "start") {
    if (value !== undefined) intensity = Math.max(10, Math.min(100, value));
    if (!running) {
      running = true;
      hashCount = 0;
      startTime = Date.now();
      self.postMessage({ type: "started" });
      mine();
    }
  } else if (cmd === "stop") {
    running = false;
    self.postMessage({ type: "stopped", hashCount });
  } else if (cmd === "setIntensity") {
    intensity = Math.max(10, Math.min(100, value));
    self.postMessage({ type: "intensitySet", intensity });
  } else if (cmd === "status") {
    const elapsed = (Date.now() - startTime) / 1000;
    self.postMessage({ type: "stats", hashCount, hashRate: (hashCount / elapsed).toFixed(1), elapsed: elapsed.toFixed(0), running });
  }
};
