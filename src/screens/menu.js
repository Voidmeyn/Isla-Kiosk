// Menu ("Explore Our Menu.") — McDonald's-kiosk style layout in the Isla look:
// category rail on the left, large product cards, rewards banner, and a sticky
// "My Order" bar. Covers the DASHBOARD frames (member, guest, six categories, with items).
import { h, mount } from '../core/dom.js';
import { store, itemCount, totals, pointsBalance, rewardPointsInCart, addRewardToCart } from '../core/store.js';
import { router } from '../core/router.js';
import { openUserMenu, scanToSignIn } from '../core/session.js';
import { categories, products, productById } from '../data/menu.js';
import { menuService, REWARD_CATALOG } from '../services/api.js';
import { php, money, firstName, plural } from '../core/format.js';
import { icon, orderTypePill, userChip, logo } from '../ui/components.js';
import { attachKeyboard } from '../ui/keyboard.js';
import { statusDialog } from '../ui/overlay.js';
import { icons } from '../ui/icons.js';
import { config } from '../config.js';
import { openAddons } from './addons.js';

const RAIL = [
  { id: 'rewards', label: 'Rewards', icon: 'starFill' },
  ...categories.map((c) => ({
    ...c,
    label: c.id === 'all' ? 'All Drinks' : c.label,
    image: c.id === 'all' ? 'assets/img/drinks/spanish-latte.webp' : products.find((p) => p.category === c.id)?.image,
  })),
];

export function menuScreen(params = {}) {
  const state = { category: params.category || store.get().menuCategory, query: '', catalog: null, error: null };
  const isMember = () => store.get().mode === 'member';

  // ---------- Header ----------
  const pointsSlot = h('div', { class: 'menu__points' });
  function renderPoints() {
    mount(pointsSlot, isMember()
      ? h('button', { class: 'points-pill', type: 'button', onClick: () => router.go('rewards'), 'aria-label': `${pointsBalance()} points. Open rewards` },
        icon('starFill'), h('strong', {}, String(pointsBalance() - rewardPointsInCart())), h('span', {}, 'pts'))
      : h('button', { class: 'points-pill points-pill--scan', type: 'button', onClick: () => scanToSignIn({ midOrder: true }) },
        icon('scanQr'), h('span', {}, 'Scan QR')));
  }
  const chipSlot = h('div');
  const renderChip = () => mount(chipSlot, userChip(openUserMenu));

  // ---------- Promo / rewards banner ----------
  const banner = h('div', { class: 'menu__banner' });
  function renderBanner() {
    const s = store.get();
    if (s.mode === 'member') {
      const avail = pointsBalance() - rewardPointsInCart();
      const ready = REWARD_CATALOG.filter((r) => r.cost <= avail).length;
      mount(banner, h('button', { class: 'promo promo--member', type: 'button', onClick: () => selectCategory('rewards') },
        h('span', { class: 'promo__badge' }, icon('sparkle')),
        h('span', { class: 'promo__text' },
          h('strong', {}, `Hi ${firstName(s.user.fullName)}! You have ${avail} points.`),
          h('small', {}, ready ? `${plural(ready, 'reward')} ready to redeem · earn ${config.pointsPerDrink} pts per drink` : `Earn ${config.pointsPerDrink} pts per drink — rewards start at 100 pts`)),
        h('span', { class: 'promo__cta' }, 'Rewards', icon('chevronRight'))));
    } else {
      const earn = totals().pointsToEarn;
      mount(banner, h('button', { class: 'promo', type: 'button', onClick: () => scanToSignIn({ midOrder: true }) },
        h('span', { class: 'promo__badge' }, icon('scanQr')),
        h('span', { class: 'promo__text' },
          h('strong', {}, earn ? `Scan your Isla QR to earn ${earn} pts on this order` : 'Isla member? Scan your QR to earn points'),
          h('small', {}, `Members earn ${config.pointsPerDrink} points on every drink and redeem free drinks.`)),
        h('span', { class: 'promo__cta' }, 'Scan QR', icon('chevronRight'))));
    }
  }

  // ---------- Category rail ----------
  const rail = h('nav', { class: 'rail scroll', 'aria-label': 'Categories' });
  function renderRail() {
    mount(rail, RAIL.map((c) => h('button', {
      class: ['rail__item', c.id === 'rewards' && 'rail__item--rewards'], type: 'button',
      'aria-pressed': String(state.category === c.id), onClick: () => selectCategory(c.id),
    },
      h('span', { class: 'rail__thumb' }, c.image ? h('img', { src: c.image, alt: '' }) : icon(c.icon)),
      h('span', { class: 'rail__label' }, c.label))));
  }
  function selectCategory(id) {
    state.category = id;
    store.get().menuCategory = id; // silent: no re-render needed
    renderRail(); renderGrid();
    grid.scrollTop = 0;
  }

  // ---------- Search ----------
  const searchInput = h('input', {
    class: 'search__input', type: 'search', placeholder: 'Search drinks and more...', 'aria-label': 'Search drinks',
    autocomplete: 'off', spellcheck: 'false', enterkeyhint: 'search',
    onInput: (e) => { state.query = e.target.value; clearBtn.hidden = !state.query; renderGrid(); },
  });
  attachKeyboard(searchInput, { kind: 'text' });
  const clearSearch = () => { searchInput.value = ''; state.query = ''; clearBtn.hidden = true; };
  const clearBtn = h('button', { class: 'icon-btn search__clear', 'aria-label': 'Clear search', hidden: true, onClick: () => { clearSearch(); renderGrid(); } }, icon('close'));
  const search = h('div', { class: 'search' }, icon('search', 'search__icon'), searchInput, clearBtn);

  // ---------- Content ----------
  const title = h('div', { class: 'menu__title' });
  const grid = h('div', { class: 'menu__grid scroll', 'aria-label': 'Drinks' });

  function productCard(p) {
    const soldOut = !p.available;
    return h('button', {
      class: ['product', soldOut && 'product--soldout'], type: 'button', disabled: soldOut,
      'aria-label': `${p.name}, ${php(p.price)}. ${soldOut ? 'Sold out' : 'Add to order'}`,
      onClick: () => openAddons(p),
    },
      h('span', { class: 'product__media' },
        h('img', { class: 'product__img', src: p.image, alt: '', loading: 'lazy', decoding: 'async' }),
        isMember() && h('span', { class: 'product__earn' }, `+${config.pointsPerDrink} pts`)),
      h('span', { class: 'product__name' }, p.name),
      h('span', { class: 'product__foot' },
        h('span', { class: 'product__price' }, php(p.price)),
        h('span', { class: 'product__add', 'aria-hidden': 'true' }, soldOut ? 'Sold out' : icon('plus'))));
  }

  function rewardCard(r) {
    const avail = pointsBalance() - rewardPointsInCart();
    const can = isMember() && avail >= r.cost;
    const add = async () => {
      if (!isMember()) { scanToSignIn({ midOrder: true }); return; }
      addRewardToCart(r);
      await statusDialog({ icon: icons.receiptCheck, title: 'Reward Redeem!', text: `A free ${r.name} was added to your order. ${r.cost} points will be used when you place the order.`, actionLabel: 'Continue Ordering' });
    };
    return h('div', { class: ['reward-tile', !can && 'is-locked'] },
      h('img', { src: r.image, alt: '' }),
      h('div', { class: 'reward-tile__info' },
        h('strong', {}, r.name),
        h('span', { class: 'reward-tile__cost' }, icon('starFill'), `${r.cost} pts`)),
      h('button', { class: 'btn btn--primary btn--sm', type: 'button', disabled: isMember() && !can, onClick: add },
        !isMember() ? 'Scan QR to redeem' : can ? 'Add free drink' : `Need ${r.cost - avail} more`));
  }

  function renderTitle(count) {
    const cat = RAIL.find((c) => c.id === state.category);
    mount(title,
      h('h1', { class: 'display display--menu' }, state.query ? 'Search results' : state.category === 'all' ? 'Explore Our Menu.' : cat.label),
      h('p', { class: 'lead lead--left' }, state.category === 'rewards' && !state.query
        ? (isMember() ? 'Use your points for a free drink.' : 'Members redeem points for free drinks.')
        : count != null ? `${plural(count, 'drink')} · Order at the kiosk, pick up at the bar.` : 'Order at the kiosk, pick up at the bar.'));
  }

  function renderGrid() {
    if (state.error) {
      renderTitle();
      return mount(grid, h('div', { class: 'empty-state' },
        icon('alert', 'empty-state__icon'),
        h('p', { class: 'empty-state__title' }, 'We couldn’t load the menu.'),
        h('p', { class: 'empty-state__text' }, state.error),
        h('button', { class: 'btn btn--primary btn--sm', onClick: load }, 'Try again')));
    }
    if (!state.catalog) { renderTitle(); return mount(grid, h('div', { class: 'loading-block' }, h('span', { class: 'spinner' }), 'Loading menu…')); }

    const q = state.query.trim().toLowerCase();
    if (state.category === 'rewards' && !q) {
      renderTitle();
      return mount(grid,
        isMember()
          ? h('div', { class: 'rewards-note' }, icon('starFill'), `You have ${pointsBalance() - rewardPointsInCart()} points available. You can also use points as a discount at checkout (${Math.round(1 / config.pesoPerPoint)} pts = ₱1).`)
          : h('button', { class: 'rewards-note rewards-note--cta', type: 'button', onClick: () => scanToSignIn({ midOrder: true }) }, icon('scanQr'), 'Scan your Isla QR to see your points and unlock these rewards.'),
        h('div', { class: 'reward-tiles' }, REWARD_CATALOG.map(rewardCard)));
    }
    const list = state.catalog.filter((p) => (q ? true : state.category === 'all' || p.category === state.category) && (!q || p.name.toLowerCase().includes(q)));
    renderTitle(list.length);
    if (!list.length) {
      return mount(grid, h('div', { class: 'empty-state' },
        icon('search', 'empty-state__icon'),
        h('p', { class: 'empty-state__title' }, `No drinks match “${state.query.trim()}”`),
        h('p', { class: 'empty-state__text' }, 'Try a different word or browse all drinks.'),
        h('button', { class: 'btn btn--outline-soft btn--sm', onClick: () => { clearSearch(); selectCategory('all'); } }, 'Show all drinks')));
    }
    mount(grid, h('div', { class: 'menu__cards' }, list.map(productCard)));
  }

  async function load() {
    state.error = null; state.catalog = null; renderGrid();
    try { state.catalog = await menuService.getCatalog(); }
    catch { state.error = 'Please check the connection and try again.'; }
    renderGrid();
  }

  // ---------- My Order bar ----------
  const bar = h('footer', { class: 'order-bar', 'aria-label': 'Your order' });
  function renderBar() {
    const s = store.get();
    const count = itemCount();
    if (!count) {
      return mount(bar,
        h('div', { class: 'order-bar__empty' },
          h('img', { src: 'assets/img/empty-cup.webp', alt: '' }),
          h('div', {}, h('strong', {}, 'YOUR ORDER · No items yet'), h('small', {}, 'Add drinks to get started'))),
        h('button', { class: 'btn btn--primary order-bar__btn', type: 'button', disabled: true }, 'Checkout'));
    }
    const t = totals(s);
    const thumbs = s.cart.slice(0, 4).map((l) => h('span', { class: 'order-bar__thumb' },
      h('img', { src: productById(l.productId)?.image, alt: '' }),
      l.qty > 1 && h('b', {}, `${l.qty}`),
      l.reward && h('i', { 'aria-label': 'Reward' }, icon('starFill'))));
    mount(bar,
      h('button', { class: 'order-bar__summary', type: 'button', onClick: () => router.go('cart'), 'aria-label': `Your order, ${plural(count, 'item')}, ${money(t.total)}` },
        h('span', { class: 'order-bar__thumbs' }, thumbs, s.cart.length > 4 && h('span', { class: 'order-bar__more' }, `+${s.cart.length - 4}`)),
        h('span', { class: 'order-bar__text' },
          h('small', {}, `YOUR ORDER · ${plural(count, 'item')}`),
          h('strong', {}, money(t.total)),
          s.mode === 'member' && t.pointsToEarn > 0 && h('em', {}, `+${t.pointsToEarn} pts`))),
      h('button', { class: 'btn btn--primary order-bar__btn', type: 'button', onClick: () => router.go('cart') }, 'Checkout', icon('chevronRight', 'btn__icon')));
  }

  const el = h('section', { class: 'menu' },
    h('header', { class: 'topbar menu__topbar' },
      h('div', { class: 'menu__brand' }, logo('menu__logo'), orderTypePill()),
      h('div', { class: 'menu__account' }, pointsSlot, chipSlot)),
    banner,
    h('div', { class: 'menu__body' },
      rail,
      h('div', { class: 'menu__main' }, title, search, grid)),
    bar,
  );

  const refreshAll = () => { renderPoints(); renderChip(); renderBanner(); renderBar(); if (state.category === 'rewards' || state.catalog) renderGrid(); };
  let lastMode = store.get().mode;
  const unsub = store.subscribe((s) => {
    renderPoints(); renderBanner(); renderBar();
    if (s.mode !== lastMode) { lastMode = s.mode; renderChip(); renderGrid(); }
    else if (state.category === 'rewards') renderGrid();
  });
  renderRail();
  refreshAll();
  load();
  return { el, onLeave: unsub };
}
