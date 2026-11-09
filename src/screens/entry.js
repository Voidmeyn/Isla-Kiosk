
import { h, onLongPress } from '../core/dom.js';
import { store, resetSession } from '../core/store.js';
import { router } from '../core/router.js';
import { startGuest, startMember } from '../core/session.js';
import { icon, logo, backButton } from '../ui/components.js';
import { openAdmin } from '../ui/admin.js';
import { config } from '../config.js';
import { openKioskQrLogin } from '../ui/kioskQrLogin.js';
import { statusDialog } from '../ui/overlay.js';
import { firstName } from '../core/format.js';

function requestFullscreen() {
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  if (!config.autoFullscreen || standalone || document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
}


export function splashScreen() {
  resetSession();
  const choose = (orderType) => {
    requestFullscreen();
    store.set({ orderType });
    router.go('welcome');
  };
  const brand = logo('splash__logo');

  onLongPress(brand, 3000, openAdmin);

  const el = h('section', { class: 'bg-palms splash', 'aria-label': 'Start your order' },
    h('div', { class: 'splash__brand' }, brand),
    h('div', { class: 'splash__cta' },
      h('h1', { class: 'splash__title' }, 'Where will you enjoy your drink?'),
      h('div', { class: 'splash__choices' },
        h('button', { class: 'splash__choice', onClick: () => choose('dine-in') }, icon('dineIn'), h('span', {}, 'Dine In')),
        h('button', { class: 'splash__choice', onClick: () => choose('take-out') }, icon('takeOut'), h('span', {}, 'Take out'))),
      h('p', { class: 'splash__hint' }, icon('touch'), 'Touch to start your order')),
    h('div', { class: 'splash__member' }, icon('scanQr'), h('span', {}, h('strong', {}, 'Isla Rewards member? '), 'Sign in with your phone to earn points.')),
  );
  return { el };
}


export function welcomeScreen() {
  const kioskQrLogin = async () => {
    const profile = await openKioskQrLogin();
    if (!profile) return;
    await statusDialog({
      title: 'Log in Successfully!',
      text: `Welcome back, ${firstName(profile.fullName)}! You have ${profile.points} points.`,
      actionLabel: 'Start ordering', dismissible: false,
    });
    startMember(profile);
  };
  const brand = h('button', { class: 'welcome__logo-btn', 'aria-label': 'Back to start', onClick: () => router.go('splash', {}, { reset: true, transition: 'fade' }) }, logo('welcome__logo'));
  const el = h('section', { class: 'bg-palms entry' },
    h('header', { class: 'topbar' }, backButton(() => router.go('splash', {}, { reset: true, transition: 'back' }), 'Start over'),
      h('span', { class: 'order-type order-type--static' }, icon(store.get().orderType === 'take-out' ? 'takeOut' : 'dineIn'), store.get().orderType === 'take-out' ? 'Take out' : 'Dine In')),
    h('div', { class: 'entry__inner welcome' },
      brand,
      h('h1', { class: 'display display--xl' }, 'Good Coffee,', h('br'), h('em', {}, 'Brighter Days')),
      h('p', { class: 'lead' }, 'Find your favorite brew and make today a little better.'),
      h('div', { class: 'welcome__options' },
        h('button', { class: 'option-card option-card--hero', type: 'button', onClick: kioskQrLogin },
          h('span', { class: 'option-card__icon' }, icon('qr')),
          h('span', { class: 'option-card__text' },
            h('strong', {}, 'Log in with QR Code'),
            h('small', {}, 'Scan with your phone and approve securely')),
          icon('chevronRight', 'option-card__chev')),
        h('button', { class: 'option-card', type: 'button', onClick: () => router.go('login') },
          h('span', { class: 'option-card__icon' }, icon('person')),
          h('span', { class: 'option-card__text' },
            h('strong', {}, 'Log In / Sign Up'),
            h('small', {}, 'Use your Student ID and PIN')),
          icon('chevronRight', 'option-card__chev')),
        h('button', { class: 'option-card option-card--guest', type: 'button', onClick: () => startGuest() },
          h('span', { class: 'option-card__icon' }, icon('walk')),
          h('span', { class: 'option-card__text' },
            h('strong', {}, 'Continue as Guest'),
            h('small', {}, 'Order without an account')),
          icon('chevronRight', 'option-card__chev'))),
      h('p', { class: 'footnote footnote--star' }, icon('star'), 'Members earn 10 points on every drink.'),
    ),
  );
  return { el };
}
