// Runtime configuration for a kiosk deployment.
// Values can be overridden per device with URL params, e.g.
//   index.html?view=portrait&preview=0&idle=120&keyboard=always&demo=0
// so each kiosk's launcher (see /kiosk) can tune behaviour without a rebuild.

const params = new URLSearchParams(location.search);
const num = (key, fallback) => (params.has(key) && !Number.isNaN(+params.get(key)) ? +params.get(key) : fallback);
const flag = (key, fallback) => (params.has(key) ? !['0', 'false', 'no'].includes(params.get(key)) : fallback);

export const config = Object.freeze({
  storeName: 'Isla Argao',
  currency: 'PHP',

  /**
   * Screen layout:
   *  'portrait'  – fixed 1080×1920 kiosk canvas, scaled to fit the window (default; what the kiosk shows)
   *  'landscape' – fixed 1920×1080 kiosk canvas, scaled to fit
   *  'fill'      – responsive, uses the whole window (tablets / phones)
   * The preview switcher remembers the last choice on this device; ?view= overrides it.
   */
  view: params.get('view') || null,
  /** Show the floating preview switcher (handy on a laptop). Kiosk launchers pass preview=0. */
  previewBar: flag('preview', true),

  /** Seconds of inactivity before the "Are you still there?" prompt (0 = off). */
  idleTimeoutSec: num('idle', 90),
  /** Seconds the prompt counts down before the kiosk resets to the splash. */
  idleCountdownSec: num('idleCountdown', 20),
  /** Seconds the order-confirmation screen stays before starting a new order. */
  confirmationResetSec: num('confirmReset', 45),

  /**
   * On-screen keyboard for text fields (name, email, search):
   *  'auto'   – show it on touch devices that lack a native soft keyboard (e.g. Windows touch kiosks);
   *             iPadOS/Android use their native keyboard.
   *  'always' – always use the in-app keyboard (recommended for locked-down kiosks).
   *  'never'  – rely on the OS keyboard / physical keyboard.
   */
  keyboard: params.get('keyboard') || 'auto',

  /** Show demo credentials, demo QR and "simulate scan" helpers (turn off in production). */
  showDemoHints: flag('demo', true),

  /** Ask the browser for fullscreen on first tap (ignored when already in kiosk/standalone mode). */
  autoFullscreen: flag('fullscreen', true),

  /** QR scanning: which camera to use ('user' = front-facing, typical for kiosks; 'environment' = rear). */
  cameraFacing: params.get('camera') || 'user',
  /** Fallback QR decoder for browsers without BarcodeDetector (Windows Chrome/Edge, iPad Safari).
   *  Tries the local copy first (place jsQR.js in src/vendor/ for offline kiosks), then this CDN URL. */
  jsqrUrls: ['src/vendor/jsQR.js', 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'],

  /** Staff PIN for the hidden admin panel (long-press the logo on the splash screen for 3 s).
   *  MOCK VALUE — move to device management / a secure backend before production. */
  adminPin: params.get('adminPin') || '2468',

  /** Mock backend tuning: simulated latency and payment failure rate (0..1). */
  mockLatencyMs: num('latency', 650),
  mockPaymentFailureRate: num('payFail', 0),

  // ---------- Rewards programme ----------
  /** "You earn 10 points with every drink you order!" (from the design) */
  pointsPerDrink: 10,
  /** Value of one point when used as a discount: 1 pt = ₱0.50 (so 100 pts = ₱50). */
  pesoPerPoint: 0.5,
  /** Points can be used in steps of this size. */
  pointsStep: 10,
});
