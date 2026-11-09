


import { h } from '../core/dom.js';
import { config } from '../config.js';
import { openKeypad } from './keypad.js';
import { openOverlay, closeButton, toast } from './overlay.js';
import { staffService } from '../services/api.js';

async function addPointsFlow() {
  const id = await openKeypad({ label: 'Member Student ID', allowDash: true, maxLength: 12, placeholder: 'Enter member Student ID' });
  if (!id) return;
  const pts = await openKeypad({ label: 'Points to add', maxLength: 5, placeholder: 'e.g. 50' });
  const n = parseInt(pts || '', 10);
  if (!n) return;
  try {
    const profile = await staffService.addPoints(id, n, 'Points added by staff');
    toast(`Added ${n} pts · ${profile.fullName.split(' ')[0]} now has ${profile.points} pts`);
  } catch (e) {
    toast(e.message || 'Could not add points', 'error');
  }
}

export async function openAdmin() {
  const pin = await openKeypad({ label: 'Staff PIN', secret: true, maxLength: 32, placeholder: 'Enter staff PIN' });
  if (pin === undefined) return;
  try {
    await staffService.login(pin);
  } catch (error) {
    toast(error.message || 'Staff sign-in failed', 'error');
    return;
  }

  let ov;
  let continueStaffSession = false;
  const row = (label, onClick) => h('button', { class: 'btn btn--outline-soft btn--sm btn--block', onClick }, label);
  const body = h('div', { class: 'modal' },
    closeButton(() => ov.close()),
    h('div', { class: 'modal__body', style: { display: 'grid', gap: '2rem' } },
      h('h2', { class: 'status__title', style: { fontSize: '6rem' } }, 'Staff tools'),
      h('p', { class: 'status__text', style: { margin: 0 } }, `Window ${innerWidth}×${innerHeight} · keyboard: ${config.keyboard} · idle: ${config.idleTimeoutSec}s`),
      row('Add reward points to a member', () => {
        continueStaffSession = true;
        ov.close();
        addPointsFlow().finally(() => staffService.logout().catch((error) => toast(error.message, 'error')));
      }),
      row(document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen', () => {
        (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())?.catch?.(() => {});
        ov.close();
      }),
      row('Reload kiosk', () => location.reload()),
      h('button', { class: 'btn btn--primary btn--sm btn--block', onClick: () => ov.close() }, 'Close')));
  ov = openOverlay(body, {
    label: 'Staff tools',
    onClose: () => {
      if (!continueStaffSession) staffService.logout().catch((error) => toast(error.message, 'error'));
    },
  });
}
