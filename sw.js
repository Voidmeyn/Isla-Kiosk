


const VERSION = 'isla-mw9iwae4';
const PRECACHE = [
  './',
  './assets/icons/card.svg',
  './assets/icons/cash.svg',
  './assets/icons/dine-in.svg',
  './assets/icons/receipt-check.svg',
  './assets/icons/take-out.svg',
  './assets/icons/wallet.svg',
  './assets/img/addons/coffee-jelly.webp',
  './assets/img/addons/condensed-milk.webp',
  './assets/img/addons/cream-cloud.webp',
  './assets/img/addons/espresso-shot.webp',
  './assets/img/bg-palms.jpg',
  './assets/img/drinks/americano.webp',
  './assets/img/drinks/blended-dark-cocoa.webp',
  './assets/img/drinks/blended-java-chips.webp',
  './assets/img/drinks/caffe-latte.webp',
  './assets/img/drinks/capuccino.webp',
  './assets/img/drinks/caramel-latte.webp',
  './assets/img/drinks/cocoa-berry.webp',
  './assets/img/drinks/creamy-cocoa.webp',
  './assets/img/drinks/dark-cocoa.webp',
  './assets/img/drinks/einspanner-latte.webp',
  './assets/img/drinks/java-chips.webp',
  './assets/img/drinks/matcha-dream.webp',
  './assets/img/drinks/matcha-espresso.webp',
  './assets/img/drinks/matcha-latte.webp',
  './assets/img/drinks/merry-matcha.webp',
  './assets/img/drinks/pink-lychee.webp',
  './assets/img/drinks/purple-lemonade.webp',
  './assets/img/drinks/spanish-latte.webp',
  './assets/img/drinks/strawberry-dream.webp',
  './assets/img/drinks/strawberry-matcha.webp',
  './assets/img/drinks/strawberry.webp',
  './assets/img/drinks/ube-dream.webp',
  './assets/img/drinks/ube-taro.webp',
  './assets/img/drinks/vanilla-latte.webp',
  './assets/img/drinks/white-mocha.webp',
  './assets/img/empty-cup.webp',
  './assets/img/guest-shop.webp',
  './assets/img/icon-192.png',
  './assets/img/icon-512.png',
  './assets/img/logo.png',
  './assets/img/logo.webp',
  './index.html',
  './manifest.webmanifest',
  './server/database.js',
  './src/config.js',
  './src/core/dom.js',
  './src/core/format.js',
  './src/core/idle.js',
  './src/core/router.js',
  './src/core/session.js',
  './src/core/store.js',
  './src/core/viewport.js',
  './src/data/menu.js',
  './src/main.js',
  './src/screens/addons.js',
  './src/screens/auth.js',
  './src/screens/cart.js',
  './src/screens/confirmation.js',
  './src/screens/entry.js',
  './src/screens/menu.js',
  './src/screens/rewards.js',
  './src/services/api.js',
  './src/services/storage.js',
  './src/ui/admin.js',
  './src/ui/components.js',
  './src/ui/icons.js',
  './src/ui/keyboard.js',
  './src/ui/keypad.js',
  './src/ui/kioskQrLogin.js',
  './src/ui/overlay.js',
  './src/vendor/qrcode.js',
  './styles/base.css',
  './styles/components.css',
  './styles/screens.css',
  './styles/tokens.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/member/'))) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(`${VERSION}-fonts`).then(async (cache) => {
      const hit = await cache.match(request);
      if (hit) return hit;
      const res = await fetch(request);
      if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
      return res;
    }));
    return;
  }



  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request, { ignoreSearch: request.mode === 'navigate' }).then((hit) => hit || fetch(request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(request, copy)); }
      return res;
    }).catch(() => caches.match('./index.html'))));
  }
});
