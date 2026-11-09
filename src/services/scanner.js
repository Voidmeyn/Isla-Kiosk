// QR input for the kiosk. Two sources, used together:
//  1. USB / serial-over-USB QR scanners in "keyboard wedge" mode (the most common kiosk
//     hardware): they "type" the code very fast and finish with Enter.
//  2. The device camera, decoded with the browser's BarcodeDetector (Chrome/Edge on macOS,
//     Android, ChromeOS) or the jsQR library as a fallback (Windows, iPadOS, Linux).
import { config } from '../config.js';

const WEDGE_MAX_GAP_MS = 60;   // scanners send keys ~5–20 ms apart; humans are far slower
const WEDGE_MIN_LENGTH = 6;

let jsqrPromise = null;
function loadJsQR() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (jsqrPromise) return jsqrPromise;
  jsqrPromise = (async () => {
    for (const src of config.jsqrUrls) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = src; s.async = true; s.onload = resolve; s.onerror = reject;
          document.head.append(s);
        });
        if (window.jsQR) return window.jsQR;
      } catch { /* try next source */ }
    }
    return null;
  })();
  return jsqrPromise;
}

async function makeDetector() {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats?.();
      if (!formats || formats.includes('qr_code')) {
        const det = new window.BarcodeDetector({ formats: ['qr_code'] });
        return async (video) => (await det.detect(video))[0]?.rawValue || null;
      }
    } catch { /* fall through to jsQR */ }
  }
  const jsQR = await loadJsQR();
  if (!jsQR) return null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    const w = 480;
    const h = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
    canvas.width = w; canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    return jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })?.data || null;
  };
}

/**
 * @param {{ video: HTMLVideoElement, onCode: (text: string, source: 'camera'|'scanner') => void,
 *           onState: (state: 'starting'|'scanning'|'no-camera'|'denied'|'no-decoder') => void }} opts
 */
export function createScanner({ video, onCode, onState }) {
  let stream = null;
  let running = false;
  let paused = false;
  let lastCode = '';
  let lastAt = 0;
  let buffer = '';
  let lastKey = 0;

  const emit = (text, source) => {
    const t = Date.now();
    if (!text || paused) return;
    if (text === lastCode && t - lastAt < 2500) return; // same code still in front of the camera
    lastCode = text; lastAt = t;
    onCode(text.trim(), source);
  };

  const onKey = (e) => {
    const t = performance.now();
    if (t - lastKey > WEDGE_MAX_GAP_MS) buffer = '';
    lastKey = t;
    if (e.key === 'Enter') {
      if (buffer.length >= WEDGE_MIN_LENGTH) { e.preventDefault(); emit(buffer, 'scanner'); }
      buffer = '';
    } else if (e.key.length === 1) {
      buffer += e.key;
    }
  };

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) { onState('no-camera'); return; }
    onState('starting');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: config.cameraFacing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch (err) {
      onState(err?.name === 'NotAllowedError' ? 'denied' : 'no-camera');
      return;
    }
    if (!running) { stop(); return; }
    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    video.muted = true;
    await video.play().catch(() => {});
    const detect = await makeDetector();
    if (!detect) { onState('no-decoder'); return; }
    onState('scanning');
    const loop = async () => {
      if (!running) return;
      if (!paused && video.readyState >= 2) {
        try { emit(await detect(video), 'camera'); } catch { /* frame not ready */ }
      }
      setTimeout(loop, 160);
    };
    loop();
  }

  function stop() {
    running = false;
    window.removeEventListener('keydown', onKey, true);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    if (video) video.srcObject = null;
  }

  return {
    start() {
      running = true;
      window.addEventListener('keydown', onKey, true);
      startCamera();
    },
    stop,
    pause() { paused = true; },
    resume() { paused = false; lastCode = ''; },
  };
}
