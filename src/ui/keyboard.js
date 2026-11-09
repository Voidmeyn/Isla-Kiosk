


import { h, svg } from '../core/dom.js';
import { icons } from './icons.js';
import { config } from '../config.js';
import { openOverlay, closeButton } from './overlay.js';

let panel = null;
let target = null;
let shift = false;
let mode = 'text';
let modalPreview = null;
let modalCursor = null;

const isMobileOS = () =>
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function useOnScreenKeyboard() {
  if (config.keyboard === 'always') return true;
  if (config.keyboard === 'never') return false;
  return window.matchMedia('(pointer: coarse)').matches && !isMobileOS();
}


export function attachKeyboard(input, { kind = 'text' } = {}) {
  if (!useOnScreenKeyboard()) return;
  input.setAttribute('inputmode', 'none');
  input.addEventListener('focus', () => showKeyboard(input, kind));
  input.addEventListener('pointerdown', () => { if (document.activeElement === input) showKeyboard(input, kind); });
}

export function attachTextKeypad(input, { label, kind = 'text' } = {}) {
  input.readOnly = true;
  input.setAttribute('inputmode', 'none');
  input.addEventListener('click', () => { void openTextKeyboard(input, { label, kind }); });
}

const ROWS = {
  text: [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'], ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'back']],
  digits: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
};

function type(text) {
  if (!target) return;
  const el = target;
  const start = modalCursor ?? el.selectionStart ?? el.value.length;
  const end = modalCursor ?? el.selectionEnd ?? el.value.length;
  let caret;
  if (text === '\b') {
    if (start === end && start > 0) el.setRangeText('', start - 1, end, 'end');
    else el.setRangeText('', start, end, 'end');
    caret = start === end ? Math.max(0, start - 1) : start;
  } else {
    if (el.maxLength > 0 && el.value.length - (end - start) + text.length > el.maxLength) return;
    el.setRangeText(text, start, end, 'end');
    caret = start + text.length;
  }
  if (modalCursor !== null) modalCursor = caret;
  else el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  updatePreview();
}

function updatePreview() {
  const p = panel?.querySelector('.osk__preview span');
  if (p && target) p.textContent = target.value || target.placeholder || '';
  if (modalPreview && target) modalPreview.textContent = target.value || target.placeholder || '';
}

function buildRows({ modal = false, onDone = hideKeyboard, onRender = render } = {}) {
  const key = (label, onPress, cls, aria) => {
    const classes = Array.isArray(cls) ? cls : [cls];
    const keyClasses = modal
      ? ['keypad__key', 'text-keypad__key',
        classes.includes('osk__key--wide') && 'keypad__key--alt',
        classes.includes('osk__key--wide') && 'text-keypad__key--wide',
        classes.includes('osk__key--space') && 'text-keypad__key--space',
        classes.includes('osk__key--done') && 'text-keypad__key--done',
        classes.includes('is-on') && 'is-on']
      : ['osk__key', ...classes];
    return h('button', {
      class: keyClasses, 'aria-label': aria || (typeof label === 'string' ? label : 'Keyboard key'),
      onPointerdown: (e) => { e.preventDefault(); onPress(); },
      onClick: (e) => { if (e.detail === 0) onPress(); },
    }, label);
  };

  const rows = [];
  const rowClass = modal ? 'text-keypad__row' : 'osk__row';
  rows.push(h('div', { class: rowClass }, ROWS.digits.map((d) => key(d, () => type(d)))));
  ROWS.text.forEach((row) => {
    rows.push(h('div', { class: rowClass }, row.map((k) => {
      if (k === 'shift') return key(svg(icons.shift), () => { shift = !shift; onRender(); }, ['osk__key--wide', shift && 'is-on'], 'Shift');
      if (k === 'back') return key(svg(icons.backspace), () => type('\b'), 'osk__key--wide', 'Backspace');
      const ch = shift ? k.toUpperCase() : k;
      return key(ch, () => { type(ch); if (shift) { shift = false; onRender(); } });
    })));
  });
  const extras = mode === 'email' ? ['@', '.', '_', '-'] : [',', '.', "'", '-'];
  const bottomKeys = [
    ...extras.map((c) => key(c, () => type(c))),
    key('space', () => type(' '), 'osk__key--space', 'Space'),
  ];
  if (mode === 'email') bottomKeys.push(key('.com', () => type('.com'), 'osk__key--wide'));
  if (!modal) bottomKeys.push(key('Done', onDone, 'osk__key--done'));
  rows.push(h('div', { class: rowClass }, bottomKeys));

  return rows;
}

function build() {
  const rows = buildRows();
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

export function openTextKeyboard(input, { label, kind = 'text' } = {}) {
  const initialValue = input.value;
  input.setSelectionRange(input.value.length, input.value.length);
  target = input;
  modalCursor = input.value.length;
  mode = kind;
  shift = false;
  modalPreview = h('span');

  let ov;
  let rows;
  const renderModalRows = () => {
    const next = h('div', { class: 'text-keypad__rows' }, buildRows({
      modal: true,
      onDone: () => ov.close(true),
      onRender: renderModalRows,
    }));
    if (rows) rows.replaceWith(next);
    rows = next;
  };
  renderModalRows();

  const done = (result) => {
    if (result !== true) {
      input.value = initialValue;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (target === input) target = null;
    modalPreview = null;
    modalCursor = null;
    document.removeEventListener('keydown', onKeyDown);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); ov.close(true); }
    else if (e.key === 'Backspace') { e.preventDefault(); type('\b'); }
    else if (e.key.length === 1) { e.preventDefault(); type(e.key); }
  };
  const body = h('div', { class: 'modal text-keypad-modal', style: { width: 'min(95.2rem, 100%)' } },
    closeButton(() => ov.close(undefined)),
    h('div', { class: 'keypad text-keypad' },
      h('div', { class: 'keypad__label' }, label),
      h('div', { class: 'keypad__display text-keypad__display', 'aria-live': 'polite' }, modalPreview),
      rows,
      h('div', { class: 'keypad__actions' },
        h('button', { class: 'btn btn--outline-soft btn--md', onClick: () => ov.close(undefined) }, 'Cancel'),
        h('button', { class: 'btn btn--primary btn--md', onClick: () => ov.close(true) }, 'Done'),
      ),
    ),
  );
  document.addEventListener('keydown', onKeyDown);
  ov = openOverlay(body, { label, onClose: done });
  updatePreview();
  return ov.closed;
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




document.addEventListener('click', (e) => {
  if (!panel) return;
  if (panel.contains(e.target) || e.target === target) return;
  if (e.target.closest?.('input')) return;
  hideKeyboard();
}, true);
