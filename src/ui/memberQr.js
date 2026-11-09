// Member QR card — the same code the Isla app shows (McDo-app style), rendered with the
// vendored encoder so it works offline. Scanning it at any kiosk signs the member in.
import { h } from '../core/dom.js';
import { qrSvg } from '../vendor/qrcode.js';
import { qrPayload } from '../services/api.js';

export const formatMemberCode = (c = '') => String(c).replace(/(\d{3})(\d{3})/, '$1 $2');

export function memberQrCard(profile, { compact = false } = {}) {
  const art = h('div', { class: 'member-qr__code', html: qrSvg(qrPayload(profile)) });
  art.firstElementChild?.setAttribute('role', 'img');
  art.firstElementChild?.setAttribute('aria-label', `Member QR code for ${profile.fullName}`);
  return h('div', { class: ['member-qr', compact && 'member-qr--compact'] },
    art,
    h('div', { class: 'member-qr__meta' },
      h('span', { class: 'eyebrow' }, 'My Isla QR'),
      h('strong', { class: 'member-qr__number' }, formatMemberCode(profile.memberCode)),
      h('small', {}, 'Scan this at any Isla kiosk to sign in and collect points.')));
}
