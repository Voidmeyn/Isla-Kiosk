// "Scan your Isla QR" sheet — McDonald's-kiosk style member sign-in.
// Accepts the member QR from the Isla app via camera or a USB QR scanner, or the
// 6-digit member code typed on the keypad. Resolves the member profile, 'pin' if the
// customer chose Student ID & PIN instead, or undefined if cancelled.
import { h, svg } from '../core/dom.js';
import { icons } from './icons.js';
import { openOverlay, closeButton } from './overlay.js';
import { openKeypad } from './keypad.js';
import { createScanner } from '../services/scanner.js';
import { authService, qrPayload } from '../services/api.js';
import { config } from '../config.js';
import { idle } from '../core/idle.js';

const STATE_TEXT = {
  starting: 'Starting camera…',
  scanning: 'Looking for your QR code…',
  'no-camera': 'Hold your QR code under the scanner below the screen.',
  denied: 'Camera is off. Use the scanner below the screen or enter your member code.',
  'no-decoder': 'Use the scanner below the screen or enter your member code.',
};

/**
 * @param {{ purpose?: 'login'|'earn', allowPin?: boolean }} opts
 *   purpose 'earn' = guest already ordering, wants to collect points on this order
 */
export function openQrLogin({ purpose = 'login', allowPin = true } = {}) {
  let ov;
  let busy = false;
  const video = h('video', { class: 'qr-scan__video', muted: true, playsinline: true, autoplay: true });
  const fallback = h('div', { class: 'qr-scan__fallback' }, svg(icons.scanQr), h('span', {}, 'Scanner ready'));
  const status = h('p', { class: 'qr-scan__status', role: 'status', 'aria-live': 'polite' }, 'Starting…');
  const viewfinder = h('div', { class: 'qr-scan__viewfinder' },
    video, fallback,
    h('span', { class: 'qr-scan__corner qr-scan__corner--tl' }), h('span', { class: 'qr-scan__corner qr-scan__corner--tr' }),
    h('span', { class: 'qr-scan__corner qr-scan__corner--bl' }), h('span', { class: 'qr-scan__corner qr-scan__corner--br' }),
    h('span', { class: 'qr-scan__line' }));

  const setStatus = (text, tone) => {
    status.className = ['qr-scan__status', tone && `qr-scan__status--${tone}`].filter(Boolean).join(' ');
    status.replaceChildren(...(tone === 'busy' ? [h('span', { class: 'spinner' })] : []), text);
  };
  const onState = (state) => {
    viewfinder.classList.toggle('has-camera', state === 'scanning' || state === 'starting');
    setStatus(STATE_TEXT[state] || '');
  };

  async function attempt(fn) {
    if (busy) return;
    busy = true;
    scanner.pause();
    setStatus('Checking your member code…', 'busy');
    try {
      const profile = await fn();
      viewfinder.classList.add('is-success');
      setStatus(`Welcome, ${profile.fullName.split(' ')[0]}!`, 'ok');
      setTimeout(() => ov.close(profile), 650);
    } catch (e) {
      setStatus(e.message || 'That code didn’t work. Try again.', 'error');
      busy = false;
      scanner.resume();
    }
  }

  const scanner = createScanner({
    video,
    onState,
    onCode: (text) => attempt(() => authService.loginWithQr(text)),
  });

  const enterCode = async () => {
    scanner.pause();
    const code = await openKeypad({ label: 'Member code (6 digits under your QR)', maxLength: 6, placeholder: 'e.g. 482917' });
    if (code) attempt(() => authService.loginWithMemberCode(code));
    else scanner.resume();
  };

  const body = h('div', { class: 'modal qr-scan' },
    closeButton(() => ov.close(undefined)),
    h('div', { class: 'qr-scan__head' },
      h('span', { class: 'eyebrow' }, purpose === 'earn' ? 'Earn points on this order' : 'Isla Rewards members'),
      h('h2', { class: 'display display--md' }, 'Scan your Isla QR'),
      h('p', { class: 'qr-scan__lead' }, 'Open the Isla app, tap ', h('strong', {}, 'Rewards → My QR'), ', and hold your phone up to the camera.')),
    viewfinder,
    status,
    h('ol', { class: 'qr-scan__steps' },
      h('li', {}, svg(icons.phone), 'Open the Isla app'),
      h('li', {}, svg(icons.qr), 'Show My QR'),
      h('li', {}, svg(icons.scanQr), 'Hold it steady')),
    h('div', { class: 'qr-scan__actions' },
      h('button', { class: 'btn btn--outline btn--sm', type: 'button', onClick: enterCode }, svg(icons.keypad, 'btn__icon'), 'Enter member code'),
      allowPin && h('button', { class: 'btn btn--outline-soft btn--sm', type: 'button', onClick: () => ov.close('pin') }, svg(icons.personBadge, 'btn__icon'), 'Use Student ID & PIN')),
    config.showDemoHints && h('div', { class: 'demo-strip' },
      h('span', {}, 'Demo: member code 482917'),
      h('button', {
        class: 'link-btn', type: 'button',
        onClick: () => attempt(() => authService.loginWithQr(qrPayload({ studentId: '7230509', memberCode: '482917' }))),
      }, 'Simulate a scan')),
  );

  idle.pause();
  ov = openOverlay(body, { label: 'Scan your Isla QR', onClose: () => { scanner.stop(); idle.resume(); } });
  scanner.start();
  return ov.closed;
}
