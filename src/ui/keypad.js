

import { h, svg } from '../core/dom.js';
import { icons } from './icons.js';
import { openOverlay, closeButton } from './overlay.js';











export function openKeypad({ label, value = '', maxLength = 12, secret = false, allowDash = false, placeholder = '' }) {
  let current = value;
  let ov;
  const display = h('div', { class: 'keypad__display', 'aria-live': 'polite' });
  const doneBtn = h('button', { class: 'btn btn--primary btn--md', onClick: () => ov.close(current) }, 'Done');

  const digitCount = () => current.replace(/\D/g, '').length;
  const refresh = () => {
    const empty = current.length === 0;
    display.classList.toggle('is-empty', empty);
    display.textContent = empty ? placeholder || label : secret ? '•'.repeat(current.length) : current;
  };
  const press = (k) => {
    if (k === 'back') current = current.slice(0, -1);
    else if (k === 'clear') current = '';
    else if (k === '-') { if (current && !current.endsWith('-') && !current.includes('-')) current += '-'; }
    else if (digitCount() < maxLength) current += k;
    refresh();
  };

  const key = (k, content, alt) =>
    h('button', { class: ['keypad__key', alt && 'keypad__key--alt'], type: 'button', 'aria-label': typeof content === 'string' ? content : k, onClick: () => press(k) }, content);

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => key(d, d));
  keys.push(allowDash ? key('-', '–', true) : key('clear', 'Clear', true));
  keys.push(key('0', '0'));
  keys.push(key('back', svg(icons.backspace), true));
  keys[keys.length - 1].setAttribute('aria-label', 'Backspace');

  const onKey = (e) => {
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('back');
    else if (e.key === '-' && allowDash) press('-');
    else if (e.key === 'Enter') ov.close(current);
  };
  document.addEventListener('keydown', onKey);

  const body = h('div', { class: 'modal', style: { width: 'min(95.2rem, 100%)' } },
    closeButton(() => ov.close(undefined)),
    h('div', { class: 'keypad' },
      h('div', { class: 'keypad__label' }, label),
      display,
      h('div', { class: 'keypad__grid' }, keys),
      h('div', { class: 'keypad__actions' },
        h('button', { class: 'btn btn--outline-soft btn--md', onClick: () => ov.close(undefined) }, 'Cancel'),
        doneBtn,
      ),
    ),
  );
  refresh();
  ov = openOverlay(body, { label, onClose: () => document.removeEventListener('keydown', onKey) });
  return ov.closed;
}
