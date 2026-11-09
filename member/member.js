import { memberWebService } from '../src/services/api.js';
import { endpoint } from '../src/services/api.js';

const root = document.getElementById('member-app');
const params = new URLSearchParams(location.search);
const challenge = params.get('token') || '';
const validChallenge = /^[A-Za-z0-9_-]{40,50}$/.test(challenge);
let profile = null;
let kiosk = null;
let notice = '';
let noticeTone = '';
let busy = false;
let completed = false;

if (challenge) history.replaceState(null, '', location.pathname);

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function button(text, onClick, secondary = false) {
  const element = node('button', `member-button${secondary ? ' member-button--secondary' : ''}`, text);
  element.type = 'button';
  element.addEventListener('click', onClick);
  return element;
}

function frame(title, description) {
  const card = node('section', 'member-card');
  const brand = node('p', 'member-brand');
  brand.append(document.createTextNode('ISLA '));
  const sub = node('span', '', 'ARGAO');
  brand.append(sub);
  card.append(brand, node('h1', '', title));
  if (description) card.append(node('p', 'member-muted', description));
  root.replaceChildren(card);
  return card;
}

function showNotice(card) {
  if (notice) card.append(node('p', `member-message${noticeTone ? ` member-message--${noticeTone}` : ''}`, notice));
}

function renderLogin() {
  const description = challenge
    ? 'Sign in to your Isla member account to review and approve this kiosk login.'
    : 'Sign in once on this phone. Later, scan a kiosk QR code to sign in automatically.';
  const card = frame('Welcome to Isla Rewards', description);
  if (challenge && kiosk?.kioskName) {
    card.append(node('p', 'member-kiosk', `Kiosk: ${kiosk.kioskName}`));
  }
  const form = node('form', 'member-form');
  const idLabel = node('label', 'member-field', 'Student ID');
  const idInput = document.createElement('input');
  idInput.name = 'studentId';
  idInput.autocomplete = 'username';
  idInput.inputMode = 'numeric';
  idInput.required = true;
  idInput.maxLength = 12;
  idLabel.append(idInput);
  const pinLabel = node('label', 'member-field', 'PIN');
  const pinInput = document.createElement('input');
  pinInput.name = 'pin';
  pinInput.type = 'password';
  pinInput.autocomplete = 'current-password';
  pinInput.inputMode = 'numeric';
  pinInput.required = true;
  pinInput.minLength = 4;
  pinInput.maxLength = 6;
  pinLabel.append(pinInput);
  const submit = node('button', 'member-button', 'Sign in securely');
  submit.type = 'submit';
  form.append(idLabel, pinLabel, submit);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    submit.disabled = true;
    submit.textContent = 'Signing in…';
    notice = '';
    try {
      profile = await memberWebService.login(idInput.value, pinInput.value);
      notice = 'Signed in. Review the kiosk approval below.';
      noticeTone = 'success';
      busy = false;
      render();
    } catch (error) {
      notice = error.message || 'Sign-in failed. Check your Student ID and PIN, then try again.';
      noticeTone = 'error';
      busy = false;
      submit.disabled = false;
      submit.textContent = 'Sign in securely';
      showNotice(card);
    }
  });
  card.append(form);
  showNotice(card);
  card.append(node('p', 'member-small', 'Your PIN is sent securely to Isla and is never saved on this phone.'));
}

function renderSignedOut() {
  const card = frame('You’re signed out', 'Sign in with your Student ID and PIN whenever you want to approve a kiosk login.');
  card.append(button('Sign in', () => { notice = ''; renderLogin(); }));
}

function renderApproved() {
  const card = frame(`Hello, ${profile.fullName}!`, 'You’re signing in to Isla Kiosk. Do you want to approve this login?');
  if (kiosk?.kioskName) card.append(node('p', 'member-kiosk', `Kiosk: ${kiosk.kioskName}`));
  const actions = node('div', 'member-actions');
  const approve = button('Approve Login', async () => {
    if (busy) return;
    busy = true;
    approve.disabled = true;
    approve.textContent = 'Approving…';
    try {
      await memberWebService.approve(challenge);
      completed = true;
      notice = 'Login approved! You can now return to Isla Kiosk.';
      noticeTone = 'success';
      renderSuccess();
    } catch (error) {
      notice = error.message || 'Could not approve this login. The QR code may have expired.';
      noticeTone = 'error';
      busy = false;
      renderApproved();
    }
  });
  const cancel = button('Cancel', async () => {
    if (busy) return;
    busy = true;
    try {
      await memberWebService.cancel(challenge);
      completed = true;
      notice = 'Login cancelled.';
      noticeTone = '';
      renderCancelled();
    } catch (error) {
      notice = error.message || 'Could not cancel this login. The QR code may have expired.';
      noticeTone = 'error';
      busy = false;
      renderApproved();
    }
  }, true);
  const signOutButton = button('Sign out on this phone', signOut, true);
  actions.append(approve, cancel, signOutButton);
  card.append(actions);
  showNotice(card);
}

function renderSuccess() {
  const card = frame('Login approved!', 'You can now return to Isla Kiosk. This page can be closed.');
  card.append(node('p', 'member-message member-message--success', 'Your approval is complete.'));
  card.append(button('Sign out on this phone', signOut, true));
}

function renderCancelled() {
  const card = frame('Login cancelled', 'This kiosk sign-in request was not approved. You can close this page.');
  card.append(button('Sign out on this phone', signOut, true));
}

function renderInvalidChallenge() {
  const card = frame('QR code expired', 'This kiosk sign-in link is invalid or has expired. Return to the kiosk and scan a newly generated code.');
  if (profile) card.append(button('Sign out', signOut, true));
}

async function signOut() {
  busy = true;
  try {
    await memberWebService.logout();
    profile = null;
    notice = 'You have been signed out.';
    noticeTone = '';
    if (completed) renderSignedOut();
    else renderLogin();
  } catch (error) {
    notice = error.message || 'Could not sign out. Please try again.';
    noticeTone = 'error';
    render();
  } finally {
    busy = false;
  }
}

function renderAccountMenu(card) {
  const actions = node('div', 'member-actions');
  if (!challenge) actions.append(button('Sign out', signOut, true));
  card.append(actions);
}

function render() {
  if (challenge && !validChallenge) return renderInvalidChallenge();
  if (challenge && (!kiosk || kiosk.status !== 'pending')) return renderInvalidChallenge();
  if (!profile) return renderLogin();
  if (challenge) return renderApproved();
  const card = frame(`Welcome back, ${profile.fullName}`, 'You’re signed in on this phone. Scan a kiosk QR code whenever you want to sign in automatically.');
  renderAccountMenu(card);
}

async function initialize() {
  if (challenge && !validChallenge) return renderInvalidChallenge();
  try {
    if (challenge) kiosk = await endpoint('/api/kiosk/qr-challenge', { payload: { challenge } });
    const result = await memberWebService.session();
    profile = result.profile;
    if (challenge && profile) {
      try {
        await memberWebService.approve(challenge);
        completed = true;
        notice = 'Login approved! You can now return to Isla Kiosk.';
        noticeTone = 'success';
        renderSuccess();
        return;
      } catch (error) {
        notice = error.message || 'Could not approve this login. The QR code may have expired.';
        noticeTone = 'error';
      }
    }
    render();
  } catch (error) {
    notice = error.message || 'Could not connect to Isla. Check your connection and scan the kiosk QR again.';
    noticeTone = 'error';
    const card = frame('Unable to connect', 'Check your connection, then try again.');
    card.append(button('Try again', initialize));
    showNotice(card);
  }
}

initialize();
