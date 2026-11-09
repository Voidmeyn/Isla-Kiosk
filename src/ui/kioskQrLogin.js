import { h } from '../core/dom.js';
import { config } from '../config.js';
import { kioskQrService } from '../services/api.js';
import { qrSvg } from '../vendor/qrcode.js';
import { openOverlay, closeButton, toast } from './overlay.js';
import { idle } from '../core/idle.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function openKioskQrLogin() {
  let overlay;
  let session = null;
  let active = true;
  let approved = false;
  let terminal = false;
  let retryTimer;
  const image = h('div', { class: 'kiosk-qr-login__image', 'aria-label': 'Kiosk sign-in QR code' });
  const status = h('p', { class: 'kiosk-qr-login__status', role: 'status', 'aria-live': 'polite' }, 'Preparing a secure sign-in code…');
  const regenerate = h('button', { class: 'btn btn--primary btn--md btn--block', type: 'button', hidden: true, onClick: start }, 'Generate a new QR code');

  const cancelCurrent = async () => {
    active = false;
    clearTimeout(retryTimer);
    if (session && !approved && !terminal) {
      try { await kioskQrService.cancel(session); } catch (error) { toast(error.message || 'The QR session will expire automatically.', 'error'); }
    }
  };

  const close = async (result) => {
    await cancelCurrent();
    overlay.close(result);
  };

  const updateStatus = (text, loading = false) => {
    status.replaceChildren(...(loading ? [h('span', { class: 'spinner' })] : []), text);
  };

  async function poll(current) {
    while (active && session === current) {
      if (Date.now() >= Date.parse(current.expiresAt)) {
        updateStatus('QR code expired. Generate a new one to try again.');
        regenerate.hidden = false;
        return;
      }
      try {
        const result = await kioskQrService.poll(current);
        if (result.status === 'approved' && result.profile) {
          approved = true;
          updateStatus('Login approved!');
          retryTimer = setTimeout(() => overlay.close(result.profile), 450);
          return;
        }
        if (result.status === 'cancelled' || result.status === 'expired') {
          terminal = true;
          updateStatus(result.status === 'cancelled' ? 'Login cancelled.' : 'QR code expired. Generate a new one to try again.');
          regenerate.hidden = result.status !== 'expired';
          return;
        }
        if (result.status === 'claimed') {
          terminal = true;
          updateStatus('This QR login has already been used. Generate a new code to try again.');
          regenerate.hidden = false;
          return;
        }
        updateStatus('Waiting for phone approval…', true);
      } catch {
        updateStatus('Connection interrupted. Reconnecting…', true);
      }
      await wait(1500);
    }
  }

  async function start() {
    clearTimeout(retryTimer);
    session = null;
    regenerate.hidden = true;
    image.replaceChildren();
    terminal = false;
    updateStatus('Preparing a secure sign-in code…', true);
    try {
      session = await kioskQrService.create();
      if (!active) {
        await kioskQrService.cancel(session).catch((error) => toast(error.message || 'The QR session will expire automatically.', 'error'));
        return;
      }
      image.innerHTML = qrSvg(session.qrUrl);
      image.firstElementChild?.setAttribute('role', 'img');
      image.firstElementChild?.setAttribute('aria-label', 'Scan this secure Isla kiosk sign-in QR code with your phone camera');
      updateStatus('Waiting for phone approval…', true);
      poll(session);
    } catch (error) {
      updateStatus(error.message || 'Could not create a sign-in code. Try again.');
      regenerate.hidden = false;
    }
  }

  const body = h('div', { class: 'modal kiosk-qr-login' },
    closeButton(() => close(undefined)),
    h('div', { class: 'kiosk-qr-login__head' },
      h('span', { class: 'eyebrow' }, config.storeName),
      h('h2', { class: 'display display--md' }, 'Log in with QR Code'),
      h('p', { class: 'lead' }, 'Scan this kiosk QR with your phone to log in.')),
    image,
    status,
    h('div', { class: 'kiosk-qr-login__steps' },
      h('span', {}, '1. Scan the QR with your phone'),
      h('span', {}, '2. Already signed in? Login is automatic'),
      h('span', {}, '3. Otherwise, sign in and approve')),
    regenerate,
    h('button', { class: 'btn btn--outline btn--md btn--block', type: 'button', onClick: () => close(undefined) }, 'Cancel'));
  idle.pause();
  overlay = openOverlay(body, {
    dismissible: false,
    label: 'Log in with QR Code',
    onClose: () => idle.resume(),
  });
  start();
  return overlay.closed;
}
