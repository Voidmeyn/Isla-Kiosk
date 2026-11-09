
import { router } from './core/router.js';
import { initViewport } from './core/viewport.js';
import { idle } from './core/idle.js';
import { endSession } from './core/session.js';
import { splashScreen, welcomeScreen } from './screens/entry.js';
import { loginScreen, signupScreen } from './screens/auth.js';
import { menuScreen } from './screens/menu.js';
import { cartScreen } from './screens/cart.js';
import { confirmationScreen } from './screens/confirmation.js';
import { rewardsScreen } from './screens/rewards.js';

router.register('splash', splashScreen);
router.register('welcome', welcomeScreen);
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


window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('gesturestart', (e) => e.preventDefault());
window.addEventListener('dragstart', (e) => e.preventDefault());


if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
