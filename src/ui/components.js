// Reusable UI building blocks that mirror components in the Figma file.
import { h, svg } from '../core/dom.js';
import { icons } from './icons.js';
import { store } from '../core/store.js';
import { firstName } from '../core/format.js';

export const icon = (name, cls) => svg(icons[name], cls);

export function backButton(onClick, label = 'Back') {
  return h('button', { class: 'back-btn', type: 'button', onClick }, icon('arrowLeft'), label);
}

/** Brown "Dine In" pill. Tapping toggles Dine In / Take out. */
export function orderTypePill() {
  const label = () => (store.get().orderType === 'take-out' ? 'Take out' : 'Dine In');
  const btn = h('button', {
    class: 'order-type', type: 'button', 'aria-label': `Order type: ${label()}. Tap to switch.`,
    onClick: () => {
      store.set((s) => ({ orderType: s.orderType === 'take-out' ? 'dine-in' : 'take-out' }));
      btn.lastChild.textContent = label();
      btn.setAttribute('aria-label', `Order type: ${label()}. Tap to switch.`);
    },
  }, icon(store.get().orderType === 'take-out' ? 'takeOut' : 'dineIn'), h('span', {}, label()));
  return btn;
}

/** "👤 Ashly" / "👤 Guest" chip. */
export function userChip(onClick) {
  const s = store.get();
  const name = s.mode === 'member' ? firstName(s.user?.fullName) : 'Guest';
  return h('button', { class: 'user-chip', type: 'button', onClick, 'aria-label': `Account: ${name}` }, icon('personBadge'), name);
}

/** Button that shows a spinner while `task` runs and is disabled meanwhile. */
export async function withBusy(button, task, busyLabel) {
  const original = [...button.childNodes];
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.replaceChildren(h('span', { class: 'spinner' }), busyLabel || '');
  try { return await task(); }
  finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.replaceChildren(...original);
  }
}

/** Material-style checkbox from the design's "Checkboxes" component. */
export function checkbox({ label, checked = false, onChange, id }) {
  const input = h('input', { type: 'checkbox', id, onChange: (e) => onChange?.(e.target.checked) });
  input.checked = checked;
  return h('label', { class: 'check' }, input, h('span', { class: 'check__box' }, icon('check')), h('span', {}, label));
}

export function stepper({ value, min = 0, max = 20, onChange, label }) {
  const out = h('output', { 'aria-live': 'polite' }, String(value));
  const dec = h('button', { type: 'button', 'aria-label': `Decrease ${label}`, onClick: () => onChange(value - 1) }, icon('minus'));
  const inc = h('button', { type: 'button', 'aria-label': `Increase ${label}`, onClick: () => onChange(value + 1) }, icon('plus'));
  dec.disabled = value <= min;
  inc.disabled = value >= max;
  return h('div', { class: 'stepper', role: 'group', 'aria-label': label }, dec, out, inc);
}

export function formError(message) {
  return h('div', { class: 'form-error', role: 'alert' }, icon('alert'), message);
}

export const logo = (cls = 'brand-logo') => h('img', { class: cls, src: 'assets/img/logo.webp', alt: 'Isla Argao' });
