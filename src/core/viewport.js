// Kiosk "stage": the app is laid out on a fixed kiosk-sized canvas (1080×1920 by default)
// and scaled to fit whatever screen it runs on. On the real kiosk the scale is 1:1; on a
// laptop you see the exact kiosk composition, letterboxed. "Fit screen" switches to a
// fully responsive layout for tablets and phones.
import { config } from '../config.js';
import { storage } from '../services/storage.js';
import { h } from './dom.js';

export const PRESETS = {
  portrait: { w: 1080, h: 1920, label: 'Kiosk portrait', short: '1080×1920' },
  landscape: { w: 1920, h: 1080, label: 'Kiosk landscape', short: '1920×1080' },
  fill: { label: 'Fit screen', short: 'Responsive' },
};
const KEY = 'isla.viewMode';
let mode = 'portrait';
let bar = null;
const listeners = new Set();

export const viewport = {
  get mode() { return mode; },
  set(next) {
    if (!PRESETS[next]) return;
    mode = next;
    storage.set(KEY, next);
    apply();
  },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

export function initViewport() {
  mode = PRESETS[config.view] ? config.view : (PRESETS[storage.get(KEY)] ? storage.get(KEY) : 'portrait');
  if (config.previewBar) buildBar();
  apply();
  window.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('resize', apply);
}

function apply() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const root = document.documentElement;
  let w, h, s, fontPx;

  if (mode === 'fill') {
    w = W; h = H; s = 1;
    const landscape = W > H;
    fontPx = landscape ? Math.min(W / 192, H / 108) : Math.min(W / 108, H / 170);
    fontPx = Math.max(5, Math.min(18, fontPx));
  } else {
    ({ w, h } = PRESETS[mode]);
    s = Math.min(W / w, H / h);
    fontPx = 10; // 1rem = 10 design px on the kiosk canvas
  }

  const x = Math.round((W - w * s) / 2);
  const y = Math.round((H - h * s) / 2);
  root.style.fontSize = `${fontPx}px`;
  root.style.setProperty('--stage-w', `${w}px`);
  root.style.setProperty('--stage-h', `${h}px`);
  root.style.setProperty('--stage-s', String(s));
  root.style.setProperty('--stage-x', `${x}px`);
  root.style.setProperty('--stage-y', `${y}px`);
  root.classList.toggle('view-fill', mode === 'fill');
  root.classList.toggle('view-kiosk', mode !== 'fill');
  root.classList.toggle('is-landscape', w > h);
  root.classList.toggle('is-portrait', w <= h);
  root.classList.toggle('is-narrow', w <= h && w < 700);
  root.classList.toggle('is-letterboxed', mode !== 'fill' && (x > 4 || y > 4));

  if (bar) renderBar(s);
  listeners.forEach((fn) => fn(mode));
}

function buildBar() {
  bar = h('div', { id: 'preview-bar', role: 'toolbar', 'aria-label': 'Preview size' });
  document.body.append(bar);
}

function renderBar(s) {
  const open = bar.classList.contains('is-open');
  bar.replaceChildren(
    h('button', {
      class: 'pv-toggle', type: 'button', 'aria-expanded': String(open), title: 'Preview size',
      onClick: () => { bar.classList.toggle('is-open'); renderBar(s); },
    }, h('span', { class: 'pv-dot' }), `${PRESETS[mode].short}${mode === 'fill' ? '' : ` · ${Math.round(s * 100)}%`}`),
    open ? h('div', { class: 'pv-menu' },
      Object.entries(PRESETS).map(([id, p]) => h('button', {
        type: 'button', class: 'pv-option', 'aria-pressed': String(id === mode),
        onClick: () => viewport.set(id),
      }, h('strong', {}, p.label), h('small', {}, p.short))),
      h('p', { class: 'pv-hint' }, 'Preview only — kiosk launchers hide this with ?preview=0')) : '',
  );
}
