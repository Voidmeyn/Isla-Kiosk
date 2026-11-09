
import { h } from '../core/dom.js';
import { store } from '../core/store.js';
import { router } from '../core/router.js';
import { endSession } from '../core/session.js';
import { money, negMoney } from '../core/format.js';
import { icon, logo } from '../ui/components.js';
import { config } from '../config.js';

const PAY_LABEL = { cash: 'Cash · Due at counter', card: 'Card · Demo approved', ewallet: 'E-Wallet · Demo approved', rewards: 'Isla Rewards' };

export function confirmationScreen() {
  const s = store.get();
  const r = s.lastOrder;
  if (!r) { queueMicrotask(() => router.go('menu', {}, { reset: true })); return { el: h('section') }; }
  const isMember = s.mode === 'member';
  const payAtCounter = r.payment.method === 'cash';
  const pickup = payAtCounter ? 'Pay at the counter when your number is called.' : 'Pick up at the bar when your number is called.';


  const pointsBox = isMember
    ? h('div', { class: 'points-summary' },
      h('div', {}, h('small', {}, 'Earned'), h('strong', { class: 'is-positive' }, `+${r.pointsEarned}`)),
      h('div', {}, h('small', {}, 'Redeemed for drinks'), h('strong', {}, r.rewardsCost ? `−${r.rewardsCost}` : '0')),
      h('div', {}, h('small', {}, 'New balance'), h('strong', {}, `${r.profile?.points ?? s.user?.points} pts`)))
    : null;


  let left = config.confirmationResetSec;
  const countText = h('span', {}, String(left));
  const ring = h('span', { class: 'countdown', style: { animationDuration: `${left}s` }, 'aria-hidden': 'true' });
  const timer = left > 0 ? setInterval(() => {
    left -= 1;
    countText.textContent = String(left);
    if (left <= 0) { clearInterval(timer); endSession(); }
  }, 1000) : null;

  const el = h('section', { class: 'confirm scroll' },
    h('div', { class: 'confirm__inner' },
      logo('confirm__logo'),
      h('h1', { class: 'display display--menu' }, 'Order Confirmed!'),
      h('p', { class: 'lead' }, 'Thank you for choosing isla.'),
      h('div', { class: 'ticket', role: 'status' },
        h('span', { class: 'ticket__label' }, 'Your order number'),
        h('strong', { class: 'ticket__number' }, r.orderNumber),
        h('span', { class: 'ticket__eta' }, r.etaText),
        h('span', { class: 'ticket__type' }, s.orderType === 'take-out' ? 'Take out' : 'Dine In')),
      h('div', { class: 'receipt' },
        h('h2', { class: 'receipt__title' }, 'What you ordered'),
        h('ul', { class: 'receipt__lines' }, r.lines.map((l) =>
          h('li', {},
            h('span', { class: 'receipt__qty' }, `${l.qty}×`),
            h('span', { class: 'receipt__name' }, l.name,
              l.reward && h('small', { class: 'is-reward' }, `★ Reward · ${l.reward} pts`),
              l.addons.map((a) => h('small', {}, `+ ${a}`))),
            h('span', { class: 'receipt__price' }, l.reward ? 'FREE' : money(l.amount))))),
        h('hr'),
        r.totals.voucher > 0 && h('div', { class: 'receipt__row' }, h('span', {}, 'Rewards discount'), h('strong', { class: 'is-positive' }, negMoney(r.totals.voucher))),
        h('div', { class: 'receipt__row' }, h('span', {}, 'Payment'), h('strong', {}, PAY_LABEL[r.payment.method] || r.payment.method)),
        h('div', { class: 'receipt__row receipt__row--total' }, h('span', {}, 'Total'), h('strong', {}, money(r.totals.total))),
        pointsBox,
        h('p', { class: 'receipt__note' }, icon(isMember ? 'star' : 'clock'),
          isMember ? `You earned ${r.pointsEarned} points. ${pickup}${r.payment.method !== 'cash' && r.payment.simulated ? ' Demo payment only; no money was charged.' : ''}` : `${pickup} Scan the kiosk QR with your phone next time to earn points.`)),
      h('div', { class: 'confirm__actions' },
        h('button', { class: 'btn btn--primary btn--lg btn--block', 'data-autofocus': true, onClick: () => router.go('menu', {}, { reset: true, transition: 'fade' }) }, 'Back to Menu'),
        isMember
          ? h('button', { class: 'btn btn--outline-soft btn--lg btn--block', onClick: () => router.go('rewards', {}, { replace: true }) }, 'View Rewards')
          : h('button', { class: 'btn btn--outline-soft btn--lg btn--block', onClick: endSession }, 'Finish'),
        timer && h('button', { class: 'confirm__restart', type: 'button', onClick: endSession }, ring, h('span', {}, 'Starting a new order in ', countText, 's · tap to finish now')))));
  return { el, onLeave: () => clearInterval(timer) };
}
