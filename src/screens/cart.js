// "Your Order" (ORDERS(CART) frame): line items, Isla Rewards (QR sign-in, voucher,
// points-as-discount with keypad input, free reward drinks), payment method, totals,
// Place Order → payment → order confirmation.
import { h, mount } from '../core/dom.js';
import {
  store, updateQty, removeLine, clearCart, itemCount, lineTotal, totals,
  pointsBalance, rewardPointsInCart, maxUsablePoints, setPointsToUse,
} from '../core/store.js';
import { router } from '../core/router.js';
import { scanToSignIn } from '../core/session.js';
import { productById, addonById } from '../data/menu.js';
import { paymentService, orderService } from '../services/api.js';
import { money, negMoney, plural, firstName } from '../core/format.js';
import { icon, backButton, orderTypePill, stepper, withBusy } from '../ui/components.js';
import { openOverlay, statusDialog, confirmDialog, toast } from '../ui/overlay.js';
import { openKeypad } from '../ui/keypad.js';
import { icons } from '../ui/icons.js';
import { idle } from '../core/idle.js';
import { config } from '../config.js';

const METHODS = [
  { id: 'card', label: 'Cards', hint: 'Scan you card to pay', icon: 'card' },
  { id: 'ewallet', label: 'E-Wallet', hint: '(G-cash, Maya, etc)', icon: 'wallet' },
  { id: 'cash', label: 'Cash', hint: 'Pay with cash on the counter', icon: 'cash' },
];
const ptsToPeso = (p) => p * config.pesoPerPoint;

export function cartScreen() {
  const body = h('div', { class: 'cart__body scroll' });
  const footer = h('div', { class: 'cart__footer' });

  function itemsSection(s) {
    return h('section', { class: 'cart__items', 'aria-label': 'Items' },
      h('p', { class: 'cart__count' }, plural(itemCount(), 'item')),
      s.cart.map((l) => {
        const p = productById(l.productId);
        const extras = Object.entries(l.addons).map(([id, q]) => `+ ${addonById(id)?.name}${q > 1 ? ` ×${q}` : ''}`);
        return h('article', { class: ['cart-item', l.reward && 'cart-item--reward'] },
          h('img', { class: 'cart-item__img', src: p.image, alt: '' }),
          h('div', { class: 'cart-item__info' },
            h('h3', { class: 'cart-item__name' }, p.name),
            l.reward
              ? h('p', { class: 'reward-badge' }, icon('starFill'), `Reward · ${l.reward.cost} pts`)
              : [extras.map((x) => h('p', { class: 'cart-item__addon' }, x)),
                stepper({ value: l.qty, min: 1, max: 20, label: `${p.name} quantity`, onChange: (v) => updateQty(l.lineId, v) })]),
          h('div', { class: 'cart-item__side' },
            h('strong', { class: 'cart-item__price' }, l.reward ? 'FREE' : money(lineTotal(l))),
            h('button', { class: 'icon-btn cart-item__remove', 'aria-label': `Remove ${p.name}`, onClick: () => removeLine(l.lineId) }, icon('trash'))));
      }));
  }

  async function enterPoints() {
    const max = maxUsablePoints();
    const v = await openKeypad({ label: `Points to use (max ${max})`, maxLength: 5, placeholder: `Up to ${max} pts` });
    if (v === undefined || v === '') return;
    const want = parseInt(v, 10) || 0;
    const applied = setPointsToUse(want);
    if (applied !== want) toast(applied ? `Applied ${applied} pts (points are used in steps of ${config.pointsStep}, up to ${max})` : `You can use up to ${max} pts on this order`);
  }

  function rewardsSection(s) {
    const t = totals(s);
    if (s.mode !== 'member') {
      return h('section', { class: 'loyalty loyalty--guest', 'aria-label': 'Isla Rewards' },
        h('span', { class: 'loyalty__qr' }, icon('scanQr')),
        h('div', { class: 'loyalty__text' },
          h('strong', {}, t.pointsToEarn ? `Earn ${t.pointsToEarn} points on this order` : 'Earn points on this order'),
          h('small', {}, 'Scan the QR in your Isla app to collect points and use your rewards.')),
        h('button', { class: 'btn btn--primary btn--sm', type: 'button', onClick: () => scanToSignIn({ midOrder: true }) }, 'Scan QR'));
    }
    const balance = pointsBalance(s);
    const avail = balance - rewardPointsInCart(s);
    const max = maxUsablePoints(s);
    const coupon = s.user?.coupons?.[0];
    const quick = [50, 100, 200].filter((q) => q <= max);

    return h('section', { class: 'loyalty', 'aria-label': 'Isla Rewards' },
      h('header', { class: 'loyalty__head' },
        h('div', {},
          h('span', { class: 'eyebrow' }, 'Isla Rewards'),
          h('strong', { class: 'loyalty__name' }, firstName(s.user.fullName))),
        h('div', { class: 'loyalty__balance' },
          h('strong', {}, String(avail - t.pointsUsed)),
          h('small', {}, `pts left${rewardPointsInCart(s) || t.pointsUsed ? ` of ${balance}` : ''}`))),

      coupon && h('button', {
        class: ['coupon', s.useCoupon && 'is-on'], type: 'button', role: 'switch', 'aria-checked': String(s.useCoupon),
        onClick: () => { store.set({ useCoupon: !s.useCoupon }); setPointsToUse(store.get().pointsToUse); },
      },
        icon('gift', 'coupon__icon'),
        h('span', { class: 'coupon__text' }, h('strong', {}, `Use Your ₱${coupon.amount} off coupon.`), h('small', {}, 'Apply your reward points for a discount')),
        h('span', { class: 'switch', 'aria-hidden': 'true' }, h('span'))),

      h('div', { class: 'points-use' },
        h('div', { class: 'points-use__text' },
          icon('coin', 'points-use__icon'),
          h('span', {},
            h('strong', {}, t.pointsUsed ? `Using ${t.pointsUsed} pts  (−${money(t.pointsDiscount)})` : 'Use points as a discount'),
            h('small', {}, `${Math.round(1 / config.pesoPerPoint)} pts = ₱1 · up to ${max} pts on this order`))),
        h('div', { class: 'points-use__actions' },
          quick.map((q) => h('button', { class: ['chip', 'chip--sm'], type: 'button', 'aria-pressed': String(t.pointsUsed === q), onClick: () => setPointsToUse(q) }, `${q}`)),
          max > 0 && h('button', { class: ['chip', 'chip--sm'], type: 'button', 'aria-pressed': String(t.pointsUsed === max && max > 0), onClick: () => setPointsToUse(max) }, 'Max'),
          h('button', { class: 'btn btn--outline btn--sm points-use__enter', type: 'button', disabled: max === 0 && !t.pointsUsed, onClick: enterPoints }, icon('keypad', 'btn__icon'), 'Enter points'),
          t.pointsUsed > 0 && h('button', { class: 'link-btn', type: 'button', onClick: () => setPointsToUse(0) }, 'Remove'))),

      h('div', { class: 'loyalty__foot' },
        h('span', {}, icon('sparkle'), t.pointsToEarn ? `You’ll earn +${t.pointsToEarn} pts with this order` : 'Reward drinks don’t earn points'),
        h('button', { class: 'link-btn', type: 'button', onClick: () => router.go('menu', { category: 'rewards' }, { reset: true, transition: 'back' }) }, 'Add a free drink')));
  }

  function paymentSection(s, t) {
    if (t.total <= 0) {
      return h('section', { class: 'payment payment--covered' }, h('h2', { class: 'section-title' }, 'Payment Method'),
        h('p', { class: 'covered-note' }, icon('starFill'), 'Fully covered by your rewards — nothing to pay.'));
    }
    return h('section', { class: 'payment', 'aria-label': 'Payment Method' },
      h('h2', { class: 'section-title' }, 'Payment Method'),
      h('div', { class: 'payment__grid', role: 'radiogroup', 'aria-label': 'Payment Method' },
        METHODS.map((m) => h('button', {
          class: 'pay-option', type: 'button', role: 'radio', 'aria-checked': String(s.paymentMethod === m.id),
          onClick: () => store.set({ paymentMethod: m.id }),
        },
          h('span', { class: 'radio', 'aria-hidden': 'true' }),
          icon(m.icon, 'pay-option__icon'),
          h('strong', {}, m.label),
          h('small', {}, m.hint)))));
  }

  function summary(s, t) {
    return h('section', { class: 'summary', 'aria-label': 'Order summary' },
      h('dl', {},
        h('div', {}, h('dt', {}, 'Subtotal'), h('dd', {}, money(t.subtotal))),
        h('div', {}, h('dt', {}, 'Discount coupon'), h('dd', {}, t.voucher ? negMoney(t.voucher) : money(0))),
        s.mode === 'member' && h('div', {}, h('dt', {}, `Points discount${t.pointsUsed ? ` (${t.pointsUsed} pts)` : ''}`), h('dd', {}, t.pointsDiscount ? negMoney(t.pointsDiscount) : money(0))),
        t.rewardPoints > 0 && h('div', {}, h('dt', {}, 'Reward drinks'), h('dd', {}, `${t.rewardPoints} pts`)),
        h('div', {}, h('dt', {}, 'Service Fee'), h('dd', {}, money(t.serviceFee))),
        h('div', { class: 'summary__total' }, h('dt', {}, 'Total'), h('dd', {}, money(t.total)))));
  }

  function render() {
    const s = store.get();
    if (!s.cart.length) {
      mount(body, h('div', { class: 'empty-state empty-state--page' },
        h('img', { src: 'assets/img/empty-cup.webp', alt: '', class: 'empty-state__art' }),
        h('p', { class: 'empty-state__title' }, 'Your order is empty'),
        h('p', { class: 'empty-state__text' }, 'Add a drink from the menu to continue.'),
        h('button', { class: 'btn btn--primary btn--md', onClick: () => router.go('menu', {}, { reset: true, transition: 'back' }) }, 'Browse Menu')));
      mount(footer);
      return;
    }
    const t = totals(s);
    mount(body, itemsSection(s), rewardsSection(s), paymentSection(s, t), summary(s, t));
    const place = h('button', { class: 'btn btn--primary place-order', type: 'button', onClick: () => placeOrder(place) },
      h('span', {}, 'Place Order'), h('span', {}, `₱${t.total.toFixed(2)}`));
    mount(footer, place,
      h('div', { class: 'cart__secondary' },
        h('button', { class: 'btn btn--outline btn--sm', onClick: () => router.go('menu', {}, { reset: true, transition: 'back' }) }, icon('bag', 'btn__icon'), 'Continue Shopping'),
        h('button', { class: 'btn btn--outline btn--sm', onClick: cancelOrder }, icon('close', 'btn__icon'), 'Cancel Order')));
  }

  async function cancelOrder() {
    const ok = await confirmDialog({ title: 'Cancel Order?', text: 'All items will be removed from your order.', confirmLabel: 'Yes, cancel order', cancelLabel: 'Keep my order' });
    if (!ok) return;
    clearCart();
    router.go('menu', {}, { reset: true, transition: 'back' });
  }

  async function placeOrder(button) {
    const s = store.get();
    const t = totals(s);
    idle.pause(); // never reset the kiosk mid-payment
    try {
      let payment;
      if (t.total <= 0) payment = { status: 'paid', method: 'rewards' };
      else if (s.paymentMethod === 'cash') payment = { status: 'pending', method: 'cash' };
      else {
        payment = await runPayment(s.paymentMethod, t.total);
        if (!payment) return; // customer cancelled
      }
      const receipt = await withBusy(button, () => orderService.place({
        cart: s.cart, orderType: s.orderType, payment, totals: t,
        user: s.mode === 'member' ? s.user : null,
        couponId: t.voucher ? s.user?.coupons?.[0]?.id : null,
      }), 'Placing order…');
      store.set({ lastOrder: receipt, cart: [], useCoupon: false, pointsToUse: 0, user: receipt.profile || s.user });
      router.go('confirmation', {}, { reset: true, transition: 'fade' });
    } catch (e) {
      const retry = await statusDialog({
        icon: icons.alert, tone: 'error', title: 'Order not placed',
        text: e.message || 'Something went wrong. Please try again or pay at the counter.',
        actionLabel: 'Try again', secondaryLabel: 'Back to order',
      });
      if (retry) placeOrder(button);
    } finally {
      idle.resume();
    }
  }

  const unsub = store.subscribe(render);
  render();
  const el = h('section', { class: 'cart' },
    h('header', { class: 'topbar' }, backButton(() => router.back('menu')), orderTypePill()),
    h('div', { class: 'cart__head' },
      h('h1', { class: 'display display--menu' }, 'Your Order'),
      h('p', { class: 'lead lead--left' }, 'Check your item before proceeding')),
    body,
    footer);
  return { el, onLeave: unsub };
}

/**
 * Card / e-wallet payment sheet. Resolves the payment result, or null if cancelled.
 * Retries on decline.
 */
function runPayment(method, amount) {
  return new Promise((resolve) => {
    let cancelled = false;
    const isCard = method === 'card';
    const status = h('p', { class: 'pay-sheet__status' }, h('span', { class: 'spinner' }), 'Waiting for payment…');
    const visual = isCard
      ? h('div', { class: 'pay-sheet__visual' }, icon('tap'))
      : h('div', { class: 'pay-sheet__qr', 'aria-label': 'Demo QR code' }, icon('qr'), h('small', {}, 'DEMO QR — not a real payment code'));
    let ov;
    const body = h('div', { class: 'modal' },
      h('div', { class: 'modal__body status pay-sheet' },
        h('h2', { class: 'status__title' }, isCard ? 'Tap or insert your card' : 'Scan to pay'),
        h('p', { class: 'status__text' }, isCard ? 'Use the card terminal below the screen.' : 'Open GCash, Maya or your banking app and scan the code.'),
        visual,
        h('p', { class: 'pay-sheet__amount' }, money(amount)),
        status,
        h('button', { class: 'btn btn--outline-soft btn--md', onClick: () => { cancelled = true; ov.close(); resolve(null); } }, 'Cancel payment')));
    ov = openOverlay(body, { dismissible: false, label: 'Payment' });

    paymentService.charge({ method, amount })
      .then((result) => { if (cancelled) return; ov.close(); resolve(result); })
      .catch(async (e) => {
        if (cancelled) return;
        ov.close();
        const again = await statusDialog({ icon: icons.alert, tone: 'error', title: 'Payment failed', text: `${e.message} You can try again or choose another payment method.`, actionLabel: 'Try again', secondaryLabel: 'Change method' });
        resolve(again ? await runPayment(method, amount) : null);
      });
  });
}
