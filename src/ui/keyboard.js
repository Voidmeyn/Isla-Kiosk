// On-screen text keyboard for kiosk text fields (full name, email, search).
// Windows/macOS kiosk browsers often have no usable soft keyboard, so the app
// brings its own. iPadOS/Android use their native keyboard in 'auto' mode.
import { h, svg } from '../core/dom.js';
import { icons } from './icons.js';
import { config } from '../config.js';

let panel = null;
let target = null;
let shift = false;
let mode = 'text';

const isMobileOS = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS reports as Mac

export function useOnScreenKeyboard() {
  if (config.keyboard === 'always') return true;
  if (config.keyboard === 'never') return false;
  return window.matchMedia('(pointer: coarse)').matches && !isMobileOS();
}

/** Wire a text input to the on-screen keyboard (no-op when the native keyboard is used). */
export function attachKeyboard(input, { kind = 'text' } = {}) {
  if (!useOnScreenKeyboard()) return;
  input.setAttribute('inputmode', 'none'); // suppress the OS keyboard, keep caret
  input.addEventListener('focus', () => showKeyboard(input, kind));
  input.addEventListener('pointerdown', () => { if (document.activeElement === input) showKeyboard(input, kind); });
}

const ROWS = {
  text: [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'back']],
  digits: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
};

function type(text) {
  if (!target) return;
  const el = target;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  if (text === '\b') {
    if (start === end && start > 0) el.setRangeText('', start - 1, end, 'end');
    else el.setRangeText('', start, end, 'end');
  } else {
    if (el.maxLength > 0 && el.value.length >= el.maxLength) return;
    el.setRangeText(text, start, end, 'end');
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  updatePreview();
}

function updatePreview() {
  const p = panel?.querySelector('.osk__preview span');
  if (p && target) p.textContent = target.value || target.placeholder || '';
}

function build() {
  const key = (label, onPress, cls, aria) =>
    h('button', {
      class: ['osk__key', cls], type: 'button', 'aria-label': aria || label,
      // pointerdown + preventDefault keeps focus (and the caret) in the input
      onPointerdown: (e) => { e.preventDefault(); onPress(); },
      onClick: (e) => { if (e.detail === 0) onPress(); }, // keyboard/AT activation
    }, label);

  const rows = [];
  rows.push(h('div', { class: 'osk__row' }, ROWS.digits.map((d) => key(d, () => type(d)))));
  ROWS.text.forEach((row) => {
    rows.push(h('div', { class: 'osk__row' }, row.map((k) => {
      if (k === 'shift') return key(svg(icons.shift), () => { shift = !shift; render(); }, ['osk__key--wide', shift && 'is-on'], 'Shift');
      if (k === 'back') return key(svg(icons.backspace), () => type('\b'), 'osk__key--wide', 'Backspace');
      const ch = shift ? k.toUpperCase() : k;
      return key(ch, () => { type(ch); if (shift) { shift = false; render(); } });
    })));
  });
  const extras = mode === 'email' ? ['@', '.', '_', '-'] : [',', '.', "'", '-'];
  rows.push(h('div', { class: 'osk__row' },
    extras.slice(0, 2).map((c) => key(c, () => type(c))),
    key('space', () => type(' '), 'osk__key--space', 'Space'),
    mode === 'email' ? key('.com', () => type('.com'), 'osk__key--wide') : extras.slice(2).map((c) => key(c, () => type(c))),
    key('Done', hideKeyboard, 'osk__key--done'),
  ));

  return h('div', { class: 'osk', role: 'group', 'aria-label': 'On-screen keyboard' },
    h('div', { class: 'osk__inner' },
      h('div', { class: 'osk__preview' }, h('span'), ''),
      rows,
    ));
}

function render() {
  const root = document.getElementById('keyboard-root');
  const next = build();
  if (panel) panel.replaceWith(next); else root.append(next);
  panel = next;
  updatePreview();
}

export function showKeyboard(input, kind = 'text') {
  target = input;
  mode = kind;
  document.body.classList.add('osk-open');
  render();
  setTimeout(() => input.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60);
}

export function hideKeyboard() {
  if (!panel) return;
  panel.remove();
  panel = null;
  document.body.classList.remove('osk-open');
  target?.blur();
  target = null;
}

// Tap outside both the keyboard and the active field closes it.
// Uses `click` (not pointerdown) so the layout only reflows after the tapped
// button has already received its click — otherwise the tap could miss.
document.addEventListener('click', (e) => {
  if (!panel) return;
  if (panel.contains(e.target) || e.target === target) return;
  if (e.target.closest?.('input')) return; // switching fields
  hideKeyboard();
}, true);
