
import { h } from './dom.js';
import { store, resetSession, itemCount, pointsBalance } from './store.js';
import { router } from './router.js';
import { openOverlay, confirmDialog, statusDialog, toast } from '../ui/overlay.js';
import { icon } from '../ui/components.js';
import { openKioskQrLogin } from '../ui/kioskQrLogin.js';
import { firstName } from './format.js';
import { authService } from '../services/api.js';

export function startGuest() {
  store.set({ mode: 'guest', user: null, useCoupon: false });
  router.go('menu', {}, { reset: true });
}

export function startMember(profile) {
  store.set({ mode: 'member', user: profile });
  router.go('menu', {}, { reset: true });
}


export function linkMember(profile) {
  store.set({ mode: 'member', user: profile });
  toast(`Signed in as ${firstName(profile.fullName)} · ${profile.points} pts`);
}






export async function scanToSignIn({ midOrder = false } = {}) {
  const result = await openKioskQrLogin();
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


export function endSession() {
  resetSession();
  router.go('splash', {}, { reset: true, transition: 'fade' });
  authService.logout().catch((error) => toast(error.message || 'Could not end the kiosk sign-in session.', 'error'));
}


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
      ? h('button', { class: 'btn btn--outline-soft btn--sm btn--block', onClick: () => { ov.close(); router.go('rewards'); } }, icon('starFill', 'btn__icon'), 'My Rewards')
      : h('button', { class: 'btn btn--outline-soft btn--sm btn--block', onClick: () => { ov.close(); scanToSignIn({ midOrder: true }); } }, icon('scanQr', 'btn__icon'), 'Log in with phone to earn points'),
    h('button', { class: 'btn btn--primary btn--sm btn--block', 'data-autofocus': true, onClick: leave }, isMember ? 'Log out' : 'Exit'),
  );
  ov = openOverlay(body, { placement: 'top', label: 'Account menu' });
}
