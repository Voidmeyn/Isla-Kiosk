// Entry flow: Splash (Dine In / Take out) → Welcome (Scan QR / Student ID / Guest) → Continue as Guest.
import { h, onLongPress } from '../core/dom.js';
import { store, resetSession } from '../core/store.js';
import { router } from '../core/router.js';
import { startGuest, scanToSignIn } from '../core/session.js';
import { icon, logo, backButton } from '../ui/components.js';
import { statusDialog } from '../ui/overlay.js';
import { openAdmin } from '../ui/admin.js';
import { config } from '../config.js';

function requestFullscreen() {
  const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
  if (!config.autoFullscreen || standalone || document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
}

/* ---------------- SPLASH SCREEN ---------------- */
export function splashScreen() {
  resetSession();
  const choose = (orderType) => {
    requestFullscreen();
    store.set({ orderType });
    router.go('welcome');
  };
  const brand = logo('splash__logo');
  // Hidden staff gesture: long-press the logo for 3 seconds.
  onLongPress(brand, 3000, openAdmin);

  const el = h('section', { class: 'bg-palms splash', 'aria-label': 'Start your order' },
    h('div', { class: 'splash__brand' }, brand),
    h('div', { class: 'splash__cta' },
      h('h1', { class: 'splash__title' }, 'Where will you enjoy your drink?'),
      h('div', { class: 'splash__choices' },
        h('button', { class: 'splash__choice', onClick: () => choose('dine-in') }, icon('dineIn'), h('span', {}, 'Dine In')),
        h('button', { class: 'splash__choice', onClick: () => choose('take-out') }, icon('takeOut'), h('span', {}, 'Take out'))),
      h('p', { class: 'splash__hint' }, icon('touch'), 'Touch to start your order')),
    h('div', { class: 'splash__member' }, icon('scanQr'), h('span', {}, h('strong', {}, 'Isla Rewards member? '), 'Have your app QR ready to earn points.')),
  );
  return { el };
}

/* ---------------- WELCOME SCREEN ---------------- */
export function welcomeScreen() {
  const brand = h('button', { class: 'welcome__logo-btn', 'aria-label': 'Back to start', onClick: () => router.go('splash', {}, { reset: true, transition: 'fade' }) }, logo('welcome__logo'));
  const el = h('section', { class: 'bg-palms entry' },
    h('header', { class: 'topbar' }, backButton(() => router.go('splash', {}, { reset: true, transition: 'back' }), 'Start over'),
      h('span', { class: 'order-type order-type--static' }, icon(store.get().orderType === 'take-out' ? 'takeOut' : 'dineIn'), store.get().orderType === 'take-out' ? 'Take out' : 'Dine In')),
    h('div', { class: 'entry__inner welcome' },
      brand,
      h('h1', { class: 'display display--xl' }, 'Good Coffee,', h('br'), h('em', {}, 'Brighter Days')),
      h('p', { class: 'lead' }, 'Find your favorite brew and make today a little better.'),
      h('div', { class: 'welcome__options' },
        h('button', { class: 'option-card option-card--hero', type: 'button', onClick: () => scanToSignIn() },
          h('span', { class: 'option-card__icon' }, icon('scanQr')),
          h('span', { class: 'option-card__text' },
            h('strong', {}, 'Scan QR to log in'),
            h('small', {}, 'Use the QR in your Isla app — earn and use points')),
          icon('chevronRight', 'option-card__chev')),
        h('button', { class: 'option-card', type: 'button', onClick: () => router.go('login') },
          h('span', { class: 'option-card__icon' }, icon('person')),
          h('span', { class: 'option-card__text' },
            h('strong', {}, 'Log In / Sign Up'),
            h('small', {}, 'Use your Student ID and PIN')),
          icon('chevronRight', 'option-card__chev')),
        h('button', { class: 'option-card option-card--guest', type: 'button', onClick: () => router.go('guest') },
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

/* ---------------- CONTINUE AS GUEST ---------------- */
export function guestScreen() {
  const go = async () => {
    const ok = await statusDialog({
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="7.5" r="3.5"/><path d="M5 20v-1.5C5 15.5 8 14 12 14s7 1.5 7 4.5V20z"/></svg>',
      title: 'Continue as Guest',
      text: 'You can browse and order but won’t earn student points. You can still scan your QR any time before paying.',
      actionLabel: 'Got it!',
    });
    if (ok) startGuest();
  };
  const el = h('section', { class: 'bg-palms entry' },
    h('header', { class: 'topbar' }, backButton(() => router.back('welcome'))),
    h('div', { class: 'entry__inner' },
      logo('entry__logo'),
      h('h1', { class: 'display display--xl' }, 'Welcome to', h('br'), 'Isla Argao'),
      h('p', { class: 'lead' }, 'Explore local favorites at your own pace.'),
      h('div', { class: 'panel guest-card' },
        h('img', { class: 'guest-card__art', src: 'assets/img/guest-shop.webp', alt: '' }),
        h('h2', { class: 'display display--lg' }, 'Guest Access'),
        h('p', { class: 'guest-card__text' }, 'Browse places, discover local products, and place orders without an account'),
        h('button', { class: 'btn btn--primary btn--md btn--block', onClick: go }, 'Continue as Guest'),
        h('div', { class: 'divider-or' }, 'or'),
        h('div', { class: 'auth-card__split' },
          h('button', { class: 'btn btn--outline btn--md', onClick: () => scanToSignIn() }, icon('scanQr', 'btn__icon'), 'Scan QR'),
          h('button', { class: 'btn btn--outline btn--md', onClick: () => router.go('login') }, 'Log In')),
      ),
      h('p', { class: 'footnote' }, 'Guest orders won’t earn student point or rewards.'),
    ),
  );
  return { el };
}
