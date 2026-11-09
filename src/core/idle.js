// Inactivity watchdog: after `idleTimeoutSec` without a touch, ask "Still there?";
// if nobody answers within `idleCountdownSec`, wipe the session and return to the splash.
import { h } from './dom.js';
import { config } from '../config.js';
import { openOverlay } from '../ui/overlay.js';

let timer = null;
let pauses = 0;
let prompt = null;
let isIdleScreen = () => false;
let onTimeout = () => {};

function arm() {
  clearTimeout(timer);
  if (!config.idleTimeoutSec || pauses > 0 || prompt || isIdleScreen()) return;
  timer = setTimeout(showPrompt, config.idleTimeoutSec * 1000);
}

function showPrompt() {
  let left = config.idleCountdownSec;
  const count = h('strong', { class: 'idle__count' }, String(left));
  let tick;
  const body = h('div', { class: 'modal' },
    h('div', { class: 'modal__body status' },
      h('div', { class: 'status__badge idle__badge' }, count),
      h('h2', { class: 'status__title' }, 'Are you still there?'),
      h('p', { class: 'status__text' }, 'For your privacy, this order will be cleared soon.'),
      h('button', { class: 'btn btn--primary btn--md', 'data-autofocus': true, onClick: () => ov.close('stay') }, 'I’m still here')));
  const ov = openOverlay(body, { dismissible: true, label: 'Are you still there?', onClose: () => { clearInterval(tick); prompt = null; arm(); } });
  prompt = ov;
  tick = setInterval(() => {
    left -= 1;
    count.textContent = String(left);
    if (left <= 0) { clearInterval(tick); ov.close('timeout'); onTimeout(); }
  }, 1000);
}

export const idle = {
  /** @param {{ isIdleScreen: () => boolean, onTimeout: () => void }} opts */
  start(opts) {
    isIdleScreen = opts.isIdleScreen;
    onTimeout = opts.onTimeout;
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((t) => window.addEventListener(t, () => { if (!prompt) arm(); }, { passive: true, capture: true }));
    arm();
  },
  poke: arm,
  pause() { pauses += 1; clearTimeout(timer); },
  resume() { pauses = Math.max(0, pauses - 1); arm(); },
};
