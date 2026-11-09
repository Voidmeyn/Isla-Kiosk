// Session-level actions shared by several screens.
import { h } from './dom.js';
import { store, resetSession, itemCount, pointsBalance } from './store.js';
import { router } from './router.js';
import { openOverlay, confirmDialog, statusDialog, toast } from '../ui/overlay.js';
import { icon } from '../ui/components.js';
import { openQrLogin } from '../ui/qrLogin.js';
import { firstName } from './format.js';

export function startGuest() {
  store.set({ mode: 'guest', user: null, useCoupon: false, pointsToUse: 0 });
  router.go('menu', {}, { reset: true });
}

export function startMember(profile) {
  store.set({ mode: 'member', user: profile, pointsToUse: 0 });
  router.go('menu', {}, { reset: true });
}

/** Sign a member in without leaving the current screen (guest scans QR mid-order). Keeps the cart. */
export function linkMember(profile) {
  store.set({ mode: 'member', user: profile, pointsToUse: 0 });
  toast(`Signed in as ${firstName(profile.fullName)} · ${profile.points} pts`);
}

/**
 * Open the QR scanner. On success:
 *  - from the welcome flow → greet and go to the menu
 *  - mid-order (guest) → link the member to this order and stay on the current screen
 */
export async function scanToSignIn({ midOrder = false } = {}) {
  const result = await openQrLogin({ purpose: midOrder ? 'earn' : 'login' });
  if (result === 'pin') { router.go('login'); return null; }
  if (!result) return null;
  if (midOrder) { linkMember(result); return result; }
  await statusDialog({
    title: 'Log in Successfully!',
    text: `Welcome back, ${firstName(result.fullName)}! You have ${result.points} points.`,
    actionLabel: 'Start ordering', dismissible: false,
  });
  startMember(result);
  return result;
}

/** Ends the customer session and returns to the attract (splash) screen. */
export function endSession() {
  resetSession();
  router.go('splash', {}, { reset: true, transition: 'fade' });
}

/** Popover under the user chip — design frames "exit" (guest) and "logout" (member). */
export function openUserMenu() {
  const s = store.get();
  const isMember = s.mode === 'member';
  const name = isMember ? firstName(s.user?.fullName) : 'Guest';
  let ov;

  const leave = async () => {
    if (itemCount() > 0) {
      ov.close();
      const ok = await confirmDialog({
        title: isMember ? 'Log out?' : 'Exit?',
        text: 'Your current order will be cleared.',
        confirmLabel: isMember ? 'Log out' : 'Exit',
        cancelLabel: 'Keep ordering',
      });
      if (!ok) return;
    }
    endSession();
  };

  const body = h('div', { class: 'popover' },
    h('div', { class: 'popover__who' },
      h('div', { class: 'popover__avatar' }, icon('person')),
      h('div', {},
        h('div', { class: 'popover__name' }, name),
        isMember && h('div', { class: 'popover__points' }, icon('starFill'), `${pointsBalance()} pts`))),
    isMember
      ? h('button', { class: 'btn btn--outline-soft btn--sm btn--block', onClick: () => { ov.close(); router.go('rewards'); } }, icon('starFill', 'btn__icon'), 'My Rewards & QR')
      : h('button', { class: 'btn btn--outline-soft btn--sm btn--block', onClick: () => { ov.close(); scanToSignIn({ midOrder: true }); } }, icon('scanQr', 'btn__icon'), 'Scan QR to earn points'),
    h('button', { class: 'btn btn--primary btn--sm btn--block', 'data-autofocus': true, onClick: leave }, isMember ? 'Log out' : 'Exit'),
  );
  ov = openOverlay(body, { placement: 'top', label: 'Account menu' });
}
