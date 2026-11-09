




const params = new URLSearchParams(location.search);
const num = (key, fallback) => (params.has(key) && !Number.isNaN(+params.get(key)) ? +params.get(key) : fallback);
const flag = (key, fallback) => (params.has(key) ? !['0', 'false', 'no'].includes(params.get(key)) : fallback);

export const config = Object.freeze({
  storeName: 'Isla Argao',
  currency: 'PHP',








  idleTimeoutSec: num('idle', 90),

  idleCountdownSec: num('idleCountdown', 20),

  confirmationResetSec: num('confirmReset', 45),








  keyboard: params.get('keyboard') || 'auto',


  autoFullscreen: flag('fullscreen', true),


  cameraFacing: params.get('camera') || 'user',


  jsqrUrls: ['src/vendor/jsQR.js', 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'],



  mockLatencyMs: num('latency', 650),
  mockPaymentFailureRate: num('payFail', 0),



  pointsPerDrink: 10,
});
