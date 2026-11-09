// Minimal screen router with a history stack and animated transitions.
// Screens are factories: (params) => { el, onEnter?(), onLeave?() }.

import { closeAllOverlays } from '../ui/overlay.js';
import { hideKeyboard } from '../ui/keyboard.js';

const registry = new Map();
const root = () => document.getElementById('app');
let stack = [];      // [{ id, params }]
let current = null;  // { id, params, view }
const listeners = new Set();

export const router = {
  register(id, factory) { registry.set(id, factory); },

  /**
   * @param {string} id screen id
   * @param {object} params passed to the screen factory
   * @param {{replace?: boolean, reset?: boolean, transition?: 'forward'|'back'|'fade'}} opts
   */
  go(id, params = {}, opts = {}) {
    const { replace = false, reset = false, transition = 'forward' } = opts;
    if (reset) stack = [];
    else if (replace) stack.pop();
    stack.push({ id, params });
    render(id, params, transition);
  },

  /** Go back one step; if there is nothing to go back to, use the fallback screen. */
  back(fallbackId = 'welcome') {
    if (stack.length > 1) {
      stack.pop();
      const prev = stack[stack.length - 1];
      render(prev.id, prev.params, 'back');
    } else {
      router.go(fallbackId, {}, { reset: true, transition: 'back' });
    }
  },

  current: () => current?.id,
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

function render(id, params, transition) {
  const factory = registry.get(id);
  if (!factory) throw new Error(`Unknown screen: ${id}`);
  closeAllOverlays();
  hideKeyboard();

  const prev = current;
  const view = factory(params);
  view.el.classList.add('screen', `screen--enter-${transition}`);
  view.el.dataset.screen = id;
  root().append(view.el);

  if (prev) {
    prev.view.onLeave?.();
    const old = prev.view.el;
    old.classList.add(`screen--leave-${transition}`);
    old.setAttribute('aria-hidden', 'true');
    old.style.pointerEvents = 'none';
    old.addEventListener('animationend', () => old.remove(), { once: true });
    setTimeout(() => old.remove(), 800); // safety if animations are disabled
  }
  view.el.addEventListener('animationend', () => view.el.classList.remove(`screen--enter-${transition}`), { once: true });

  current = { id, params, view };
  view.onEnter?.();
  // Move focus into the new screen for screen readers / keyboards without scrolling.
  view.el.setAttribute('tabindex', '-1');
  view.el.focus({ preventScroll: true });
  listeners.forEach((fn) => fn(id));
}
