// Background compute web worker.
// Performs SHA-256 hash loops in the background as a generic proof-of-work
// helper for the host application. Pure JavaScript, uses only the standard
// WebCrypto API. No network requests, no external resources, no persistence.

let running = false;
let intensity = 50;
let count = 0;
let startTime = Date.now();

async function digest(data) {
  const encoded = new TextEncoder().encode(data);
  const buf = await crypto.subtle.digest("SHA-256", encoded);
  const arr = Array.from(new Uint8Array(buf));
  return arr.map(b => b.toString(16).padStart(2, "0")).join("");
}

function pause(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function loop() {
  let nonce = Math.floor(Math.random() * 1e9);
  const jobId = Math.random().toString(36).substring(2);
  while (running) {
    const data = `task:${jobId}:${nonce}:${Date.now()}`;
    await digest(data);
    count++;
    nonce++;
    const ms = Math.floor((100 - intensity) * 0.8);
    if (ms > 0 && nonce % 10 === 0) await pause(ms);
    if (count % 500 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = count / elapsed;
      self.postMessage({ type: "stats", hashCount: count, hashRate: rate.toFixed(1), elapsed: elapsed.toFixed(0) });
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
      count = 0;
      startTime = Date.now();
      self.postMessage({ type: "started" });
      loop();
    }
  } else if (cmd === "stop") {
    running = false;
    self.postMessage({ type: "stopped", hashCount: count });
  } else if (cmd === "setIntensity") {
    intensity = Math.max(10, Math.min(100, value));
    self.postMessage({ type: "intensitySet", intensity });
  } else if (cmd === "status") {
    const elapsed = (Date.now() - startTime) / 1000;
    self.postMessage({ type: "stats", hashCount: count, hashRate: (count / elapsed).toFixed(1), elapsed: elapsed.toFixed(0), running });
  }
};
