// "user reward" frame: profile + member QR, points progress, rewards to add to the order, points history.
import { h, mount } from '../core/dom.js';
import { store, addRewardToCart, rewardPointsInCart } from '../core/store.js';
import { router } from '../core/router.js';
import { openUserMenu } from '../core/session.js';
import { rewardsService } from '../services/api.js';
import { initials, maskId, shortDate } from '../core/format.js';
import { icon, backButton, userChip } from '../ui/components.js';
import { statusDialog } from '../ui/overlay.js';
import { memberQrCard } from '../ui/memberQr.js';
import { icons } from '../ui/icons.js';
import { config } from '../config.js';

export function rewardsScreen() {
  const s = store.get();
  if (s.mode !== 'member') { queueMicrotask(() => router.go('login', {}, { replace: true })); return { el: h('section') }; }

  const content = h('div', { class: 'rewards__content' });
  let showId = false;
  let data = null;

  async function load() {
    mount(content, h('div', { class: 'loading-block' }, h('span', { class: 'spinner' }), 'Loading your rewards…'));
    try {
      data = await rewardsService.getSummary(s.user.studentId);
      store.set({ user: { ...store.get().user, ...data.profile } });
      render();
    } catch {
      mount(content, h('div', { class: 'empty-state' },
        icon('alert', 'empty-state__icon'),
        h('p', { class: 'empty-state__title' }, 'We couldn’t load your rewards.'),
        h('button', { class: 'btn btn--primary btn--sm', onClick: load }, 'Try again')));
    }
  }

  async function addReward(reward) {
    addRewardToCart(reward);
    const back = await statusDialog({
      icon: icons.receiptCheck, title: 'Reward Redeem!',
      text: `A free ${reward.name} was added to your order. ${reward.cost} points will be used when you place the order.`,
      actionLabel: 'Back to Menu', secondaryLabel: 'Stay on Rewards',
    });
    if (back !== false) router.go('menu', {}, { reset: true, transition: 'back' });
    else render();
  }

  function render() {
    const { profile, nextReward, catalog, history } = data;
    const reserved = rewardPointsInCart();
    const avail = profile.points - reserved;
    const pct = Math.min(100, Math.round((profile.points / nextReward.target) * 100));
    const idText = h('span', {}, showId ? profile.studentId : maskId(profile.studentId));
    const eyeBtn = h('button', { class: 'icon-btn rewards__eye', 'aria-label': showId ? 'Hide Student ID' : 'Show Student ID', onClick: () => { showId = !showId; render(); } }, icon(showId ? 'eyeOff' : 'eye'));

    mount(content,
      h('section', { class: 'panel profile-card' },
        h('div', { class: 'profile-card__top' },
          h('div', { class: 'avatar' }, initials(profile.fullName)),
          h('div', { class: 'profile-card__who' },
            h('h1', { class: 'profile-card__name' }, profile.fullName),
            h('p', { class: 'profile-card__id' }, 'Student ID - ', idText, eyeBtn)),
          h('div', { class: 'profile-card__points' }, h('strong', {}, String(profile.points)), h('span', {}, 'points'))),
        h('div', { class: 'progress' },
          h('div', { class: 'progress__labels' }, h('span', {}, `Next: ${nextReward.name}`), h('small', {}, `${profile.points}/ ${nextReward.target} points`)),
          h('div', { class: 'progress__track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(nextReward.target), 'aria-valuenow': String(profile.points) },
            h('div', { class: 'progress__bar', style: { width: `${pct}%` } })),
          h('p', { class: 'progress__hint' }, `You earn ${config.pointsPerDrink} points with every drink you order! Use points at checkout: ${Math.round(1 / config.pesoPerPoint)} pts = ₱1.`)),
        memberQrCard(profile, { compact: true })),
      h('h2', { class: 'section-title section-title--display' }, 'Available Rewards'),
      h('div', { class: 'reward-grid' }, catalog.map((r) => {
        const short = avail < r.cost;
        return h('article', { class: ['reward-card', short && 'is-locked'] },
          h('img', { src: r.image, alt: '' }),
          h('h3', {}, r.name),
          h('p', {}, `${r.cost} pts`),
          h('button', { class: 'btn btn--primary btn--sm btn--block', disabled: short, onClick: () => addReward(r) }, short ? `Need ${r.cost - avail} more` : 'Redeem'));
      })),
      reserved > 0 && h('p', { class: 'rewards-note' }, icon('starFill'), `${reserved} pts are set aside for rewards already in your order.`),
      h('h2', { class: 'section-title section-title--display' }, 'Points History'),
      history.length
        ? h('ul', { class: 'panel history' }, history.map((e) =>
          h('li', { class: 'history__row' },
            h('span', { class: 'history__icon' }, icon(e.type === 'redeem' ? 'gift' : 'starFill')),
            h('span', { class: 'history__what' }, h('strong', {}, e.label), h('small', {}, shortDate(e.at))),
            h('span', { class: ['history__pts', e.points > 0 && 'is-positive'] }, `${e.points > 0 ? '+' : ''}${e.points} pts`))))
        : h('div', { class: 'panel empty-state' }, h('p', { class: 'empty-state__title' }, 'No points yet'), h('p', { class: 'empty-state__text' }, 'Your earned and redeemed points will show here.')));
  }

  load();
  const el = h('section', { class: 'rewards' },
    h('header', { class: 'topbar' }, backButton(() => router.back('menu')), userChip(openUserMenu)),
    h('div', { class: 'rewards__scroll scroll' }, content),
    h('p', { class: 'footnote menu__note' }, 'Orders now to earn student point or rewards.'));
  return { el };
}
