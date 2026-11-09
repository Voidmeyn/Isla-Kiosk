
import { h } from '../core/dom.js';
import { router } from '../core/router.js';
import { startGuest, startMember, scanToSignIn } from '../core/session.js';
import { authService } from '../services/api.js';
import { storage } from '../services/storage.js';
import { icon, logo, backButton, checkbox, withBusy, formError } from '../ui/components.js';
import { openKeypad } from '../ui/keypad.js';
import { statusDialog, infoDialog } from '../ui/overlay.js';
import { attachKeyboard, attachTextKeypad } from '../ui/keyboard.js';
import { firstName } from '../core/format.js';

const REMEMBER_KEY = 'isla.rememberedStudentId';
const digits = (s) => s.replace(/\D/g, '');


function keypadField({ label, caps = false, placeholder, secret = false, allowDash = false, maxLength = 12, value = '' }) {
  let current = value;
  let revealed = false;
  const shown = h('span');
  const err = h('div', { class: 'field__error', 'aria-live': 'polite' });
  const control = h('button', { type: 'button', class: 'field__control', 'aria-label': label });
  const eyeBtn = secret && h('button', {
    type: 'button', class: 'icon-btn field__adorn', 'aria-label': 'Show PIN',
    onClick: () => { revealed = !revealed; eyeBtn.replaceChildren(icon(revealed ? 'eyeOff' : 'eye')); eyeBtn.setAttribute('aria-label', revealed ? 'Hide PIN' : 'Show PIN'); refresh(); },
  }, icon('eye'));

  const refresh = () => {
    if (!current) { shown.className = 'field__placeholder'; shown.textContent = placeholder; return; }
    shown.className = secret && !revealed ? 'field__pin-dots' : '';
    shown.textContent = secret && !revealed ? '•'.repeat(current.length) : current;
  };
  control.append(shown);
  control.addEventListener('click', async () => {
    control.classList.add('is-active');
    const v = await openKeypad({ label, value: current, secret: secret && !revealed, allowDash, maxLength, placeholder });
    control.classList.remove('is-active');
    if (v !== undefined) { current = v; api.setError(''); refresh(); }
  });
  refresh();

  const el = h('div', { class: 'field' },
    h('span', { class: ['field__label', caps && 'field__label--caps'] }, label),
    h('div', { class: 'field__wrap' }, control, eyeBtn),
    err,
  );
  const api = {
    el,
    get value() { return current; },
    set value(v) { current = v; refresh(); },
    setError(msg) { err.textContent = msg || ''; control.setAttribute('aria-invalid', msg ? 'true' : 'false'); },
  };
  return api;
}

function textField({ label, placeholder, kind = 'text', autocomplete = 'off', maxLength = 80, modalKeyboard = false }) {
  const err = h('div', { class: 'field__error', 'aria-live': 'polite' });
  const input = h('input', {
    class: 'field__control', type: 'text', placeholder, autocomplete, maxlength: maxLength,
    autocapitalize: kind === 'email' ? 'off' : 'words', spellcheck: 'false',
    inputmode: kind === 'email' ? 'email' : 'text', 'aria-label': label,
    onInput: () => api.setError(''),
  });
  if (modalKeyboard) attachTextKeypad(input, { label, kind });
  else attachKeyboard(input, { kind });
  const el = h('label', { class: 'field' }, h('span', { class: 'field__label field__label--caps' }, label), h('div', { class: 'field__wrap' }, input), err);
  const api = {
    el, input,
    get value() { return input.value.trim(); },
    setError(msg) { err.textContent = msg || ''; input.setAttribute('aria-invalid', msg ? 'true' : 'false'); },
  };
  return api;
}


export function loginScreen({ prefillId } = {}) {
  const remembered = storage.get(REMEMBER_KEY, '');
  let remember = Boolean(remembered);
  const idField = keypadField({ label: 'Student ID', placeholder: 'e.g. 2023-00123', allowDash: true, maxLength: 12, value: prefillId || remembered || '' });
  const pinField = keypadField({ label: 'PIN', placeholder: '4-6 digit PIN', secret: true, maxLength: 6 });
  const errorBox = h('div', { 'aria-live': 'assertive' });

  const submit = h('button', { class: 'btn btn--primary btn--lg btn--block', type: 'button' }, 'Log In');
  submit.addEventListener('click', async () => {
    errorBox.replaceChildren();
    const id = digits(idField.value);
    const pin = pinField.value;
    let bad = false;
    if (id.length < 5) { idField.setError('Enter your Student ID.'); bad = true; }
    if (!/^\d{4,6}$/.test(pin)) { pinField.setError('PIN must be 4–6 digits.'); bad = true; }
    if (bad) return;
    try {
      const profile = await withBusy(submit, () => authService.login(id, pin), 'Logging in…');
      if (remember) storage.set(REMEMBER_KEY, idField.value); else storage.remove(REMEMBER_KEY);

      await statusDialog({ title: 'Log in Successfully!', text: `Welcome back, ${firstName(profile.fullName)}!`, actionLabel: 'Continue', dismissible: false });
      startMember(profile);
    } catch (e) {
      pinField.value = '';
      errorBox.replaceChildren(formError(e.code === 'INVALID_CREDENTIALS' ? e.message : 'We couldn’t reach the server. Please try again.'));
    }
  });

  const forgot = () => infoDialog({
    title: 'Forgot PIN?',
    content: h('p', { class: 'lead', style: { textAlign: 'left' } }, 'For your security, PINs can only be reset at the counter. Please show your student ID to our staff and they will help you set a new PIN.'),
  });

  const el = h('section', { class: 'bg-palms entry' },
    h('header', { class: 'topbar' }, backButton(() => router.back('welcome'))),
    h('div', { class: 'entry__inner' },
      logo('entry__logo entry__logo--sm'),
      h('h1', { class: 'display display--xl' }, 'Welcome Back.'),
      h('p', { class: 'lead' }, 'Log in to access your account and rewards.'),
      h('form', { class: 'panel auth-card', onSubmit: (e) => e.preventDefault() },
        idField.el,
        pinField.el,
        h('div', { class: 'auth-card__row' },
          checkbox({ label: 'Remember my Student ID', checked: remember, onChange: (v) => (remember = v) }),
          h('button', { class: 'link-btn', type: 'button', onClick: forgot }, 'Forgot PIN?'),
        ),
        errorBox,
        submit,
        h('button', { class: 'btn btn--outline btn--md btn--block', type: 'button', onClick: () => scanToSignIn() }, icon('scanQr', 'btn__icon'), 'Scan kiosk QR with phone'),
        h('div', { class: 'divider-or' }, 'or'),
        h('div', { class: 'auth-card__split' },
          h('button', { class: 'btn btn--outline btn--md', type: 'button', onClick: () => router.go('signup') }, 'Create Account'),
          h('button', { class: 'btn btn--guest btn--md', type: 'button', onClick: () => startGuest() }, 'Continue as Guest'),
        ),
      ),
      h('p', { class: 'footnote' }, 'Guests can browse and order, but won’t earn student points or rewards.'),
    ),
  );
  return { el };
}


export function signupScreen() {
  const idField = keypadField({ label: 'Student ID', caps: true, placeholder: 'Enter your Student ID', allowDash: true, maxLength: 12 });
  const nameField = textField({ label: 'Full Name', placeholder: 'Enter your full name', autocomplete: 'name', modalKeyboard: true });
  const emailField = textField({ label: 'Email Address', placeholder: 'Enter your email', kind: 'email', autocomplete: 'email', modalKeyboard: true });
  const pinField = keypadField({ label: 'Create PIN', caps: true, placeholder: '4-6 digit PIN', secret: true, maxLength: 6 });
  const pin2Field = keypadField({ label: 'Confirm PIN', caps: true, placeholder: '4-6 digit PIN', secret: true, maxLength: 6 });
  let agreed = false;
  const agreeErr = h('div', { class: 'field__error' });
  const errorBox = h('div', { 'aria-live': 'assertive' });

  const terms = () => infoDialog({
    title: 'Terms & Privacy',
    content: h('div', { class: 'terms' },
      h('p', {}, 'PLACEHOLDER — replace with the café’s actual Terms of Service and Privacy Policy before launch.'),
      h('p', {}, 'Your Student ID, name and email are used to manage your rewards account and order history. Your PIN is never shown on this kiosk.'),
    ),
  });

  const submit = h('button', { class: 'btn btn--primary btn--md btn--block', type: 'button' }, 'Create Account');
  submit.addEventListener('click', async () => {
    errorBox.replaceChildren();
    const id = digits(idField.value);
    let bad = false;
    if (id.length < 5) { idField.setError('Enter a valid Student ID.'); bad = true; }
    if (nameField.value.length < 2) { nameField.setError('Enter your full name.'); bad = true; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailField.value)) { emailField.setError('Enter a valid email address.'); bad = true; }
    if (!/^\d{4,6}$/.test(pinField.value)) { pinField.setError('PIN must be 4–6 digits.'); bad = true; }
    else if (pinField.value !== pin2Field.value) { pin2Field.setError('PINs don’t match.'); bad = true; }
    if (!agreed) { agreeErr.textContent = 'Please agree to continue.'; bad = true; }
    if (bad) return;
    try {
      const profile = await withBusy(submit, () => authService.signup({ studentId: id, fullName: nameField.value, email: emailField.value, pin: pinField.value }), 'Creating…');
      await statusDialog({ title: 'Account Created!', text: 'Your account has been successfully registered. Sign in to view your points and rewards.', actionLabel: 'Continue', dismissible: false });
      router.go('login', { prefillId: idField.value }, { replace: true });
    } catch (e) {
      if (e.code === 'ID_EXISTS') idField.setError(e.message);
      else if (e.code === 'EMAIL_EXISTS') emailField.setError(e.message);
      else errorBox.replaceChildren(formError('We couldn’t create your account. Please try again.'));
    }
  });

  const el = h('section', { class: 'bg-palms entry entry--form' },
    h('header', { class: 'topbar' }, backButton(() => router.back('login'))),
    h('div', { class: 'entry__inner scroll' },
      h('h1', { class: 'display display--lg' }, 'Create Account'),
      h('p', { class: 'lead' }, 'Join Isla Argao and start earning rewards.'),
      h('form', { class: 'panel auth-card auth-card--signup', onSubmit: (e) => e.preventDefault() },
        idField.el, nameField.el, emailField.el, pinField.el, pin2Field.el,
        h('div', { class: 'auth-card__agree' },
          checkbox({ label: 'I agree to the', onChange: (v) => { agreed = v; agreeErr.textContent = ''; } }),
          h('button', { class: 'link-btn', type: 'button', onClick: terms }, 'Terms and Privacy Policy'),
        ),
        agreeErr,
        errorBox,
        submit,
        h('div', { class: 'divider-or' }, 'or'),
        h('button', { class: 'btn btn--outline btn--md btn--block', type: 'button', onClick: () => router.back('login') }, 'Back to Log In'),
      ),
      h('p', { class: 'footnote' }, 'Your student ID unlocks points and exclusive rewards.'),
    ),
  );
  return { el };
}
