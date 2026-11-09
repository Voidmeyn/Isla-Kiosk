// App bootstrap: register screens, start idle watchdog, register the service worker.
import { router } from './core/router.js';
import { initViewport } from './core/viewport.js';
import { idle } from './core/idle.js';
import { endSession } from './core/session.js';
import { splashScreen, welcomeScreen, guestScreen } from './screens/entry.js';
import { loginScreen, signupScreen } from './screens/auth.js';
import { menuScreen } from './screens/menu.js';
import { cartScreen } from './screens/cart.js';
import { confirmationScreen } from './screens/confirmation.js';
import { rewardsScreen } from './screens/rewards.js';

router.register('splash', splashScreen);
router.register('welcome', welcomeScreen);
router.register('guest', guestScreen);
router.register('login', loginScreen);
router.register('signup', signupScreen);
router.register('menu', menuScreen);
router.register('cart', cartScreen);
router.register('confirmation', confirmationScreen);
router.register('rewards', rewardsScreen);

initViewport();
router.go('splash', {}, { reset: true, transition: 'fade' });

idle.start({
  isIdleScreen: () => router.current() === 'splash',
  onTimeout: endSession,
});
router.onChange(() => idle.poke());

// Block context menus / long-press menus and browser gestures that would break kiosk mode.
window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('gesturestart', (e) => e.preventDefault()); // iOS pinch
window.addEventListener('dragstart', (e) => e.preventDefault());

// Offline support (requires http(s) or localhost — not file://)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
