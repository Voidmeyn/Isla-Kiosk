// Modals, status dialogs, confirmations, popovers and toasts.
import { h, svg } from '../core/dom.js';
import { icons } from './icons.js';

const stack = [];
const root = () => document.getElementById('overlay-root');

/**
 * Open an overlay containing `content`.
 * @returns {{ el: HTMLElement, close: (result?: any) => void, closed: Promise<any> }}
 */
export function openOverlay(content, { dismissible = true, onClose, placement = 'center', label = 'Dialog' } = {}) {
  let resolve;
  const closed = new Promise((r) => (resolve = r));
  const el = h('div', {
    class: ['overlay', placement === 'top' && 'overlay--top'],
    role: 'dialog', 'aria-modal': 'true', 'aria-label': label,
  }, content);

  let done = false;
  const close = (result) => {
    if (done) return;
    done = true;
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    el.classList.add('is-closing');
    setTimeout(() => el.remove(), 170);
    onClose?.(result);
    resolve(result);
  };
  if (dismissible) el.addEventListener('click', (e) => { if (e.target === el) close(undefined); });

  const entry = { el, close, dismissible };
  stack.push(entry);
  root().append(el);
  // Focus first actionable control for accessibility / hardware keyboards.
  requestAnimationFrame(() => el.querySelector('[data-autofocus], button, [tabindex="0"]')?.focus({ preventScroll: true }));
  return { el, close, closed };
}

export function closeAllOverlays() { [...stack].forEach((o) => o.close(undefined)); }
export const hasOverlay = () => stack.length > 0;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) {
    const top = stack[stack.length - 1];
    if (top.dismissible) top.close(undefined);
  }
});

export const closeButton = (onClick) =>
  h('button', { class: 'icon-btn modal__close', 'aria-label': 'Close', onClick }, svg(icons.close));

/**
 * Status dialog used for: Account Created, Log in Successfully, Continue as Guest,
 * Added to Order, Reward Redeem, and error states.
 * Resolves `true` when the primary action is pressed, `undefined` if dismissed.
 */
export function statusDialog({ icon = icons.checkBig, title, text, actionLabel = 'Continue', tone, secondaryLabel, dismissible = true, autoCloseMs = 0 }) {
  let ov;
  let timer;
  const body = h('div', { class: 'modal' },
    dismissible && closeButton(() => ov.close(undefined)),
    h('div', { class: 'modal__body status' },
      h('div', { class: ['status__badge', tone === 'error' && 'status__badge--error'] }, svg(icon)),
      h('h2', { class: 'status__title' }, title),
      text && h('p', { class: 'status__text' }, text),
      h('button', { class: 'btn btn--primary btn--md', 'data-autofocus': true, onClick: () => ov.close(true) }, actionLabel),
      secondaryLabel && h('button', { class: 'btn btn--outline-soft btn--md', style: { marginTop: '1.6rem' }, onClick: () => ov.close(false) }, secondaryLabel),
      autoCloseMs > 0 && h('span', { class: 'status__timer', style: { animationDuration: `${autoCloseMs}ms` }, 'aria-hidden': 'true' }),
    ),
  );
  ov = openOverlay(body, { dismissible, label: title, onClose: () => clearTimeout(timer) });
  if (autoCloseMs > 0) timer = setTimeout(() => ov.close(true), autoCloseMs);
  return ov.closed;
}

/** Yes/No confirmation. Resolves true/false. */
export function confirmDialog({ title, text, confirmLabel = 'Yes', cancelLabel = 'Cancel', icon = icons.alert, tone }) {
  return statusDialog({ icon, title, text, actionLabel: confirmLabel, secondaryLabel: cancelLabel, tone })
    .then((r) => r === true);
}

/** Simple info sheet with arbitrary content (Terms, Forgot PIN …). */
export function infoDialog({ title, content, actionLabel = 'Got it' }) {
  let ov;
  const body = h('div', { class: 'modal' },
    closeButton(() => ov.close()),
    h('div', { class: 'modal__body', style: { display: 'grid', gap: '2.4rem' } },
      h('h2', { class: 'status__title', style: { fontSize: '6rem' } }, title),
      h('div', { class: 'info-content' }, content),
      h('button', { class: 'btn btn--primary btn--md btn--block', onClick: () => ov.close() }, actionLabel),
    ),
  );
  ov = openOverlay(body, { label: title });
  return ov.closed;
}

let toastRoot;
export function toast(message, tone = 'info', ms = 2600) {
  if (!toastRoot) { toastRoot = h('div', { class: 'toast-root', role: 'status', 'aria-live': 'polite' }); (document.getElementById('stage') || document.body).append(toastRoot); }
  const t = h('div', { class: ['toast', tone === 'error' && 'toast--error'] }, message);
  toastRoot.append(t);
  setTimeout(() => t.remove(), ms);
}
