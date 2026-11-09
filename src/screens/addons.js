
import { h, mount } from '../core/dom.js';
import { addToCart, store } from '../core/store.js';
import { config } from '../config.js';
import { addons, MAX_ADDON_QTY } from '../data/menu.js';
import { money, php } from '../core/format.js';
import { stepper } from '../ui/components.js';
import { openOverlay, closeButton, statusDialog } from '../ui/overlay.js';
import { icons } from '../ui/icons.js';

export function openAddons(product) {
  const qty = Object.fromEntries(addons.map((a) => [a.id, 0]));
  let drinkQty = 1;
  let ov;

  const list = h('div', { class: 'addons__list' });
  const summary = h('div', { class: 'addons__summary' });
  const subtotal = h('strong');

  const unit = () => product.price + addons.reduce((s, a) => s + a.price * qty[a.id], 0);

  function renderList() {
    if (!product.addons) {
      return mount(list, h('p', { class: 'addons__none' }, 'This drink is served as is — no add-ons available.'));
    }
    mount(list, addons.map((a) =>
      h('div', { class: 'addon' },
        h('img', { class: 'addon__img', src: a.image, alt: '' }),
        h('div', { class: 'addon__info' }, h('span', { class: 'addon__name' }, a.name), h('span', { class: 'addon__price' }, `+ ₱ ${a.price}`)),
        stepper({ value: qty[a.id], min: 0, max: MAX_ADDON_QTY, label: a.name, onChange: (v) => { qty[a.id] = Math.max(0, Math.min(MAX_ADDON_QTY, v)); render(); } }),
      )));
  }
  function renderSummary() {
    const extras = addons.filter((a) => qty[a.id] > 0);
    mount(summary,
      h('div', { class: 'addons__line' },
        stepper({ value: drinkQty, min: 1, max: 10, label: `${product.name} quantity`, onChange: (v) => { drinkQty = Math.max(1, Math.min(10, v)); render(); } }),
        h('span', { class: 'addons__line-name' }, product.name, extras.map((a) => h('small', {}, `+ ${a.name}${qty[a.id] > 1 ? ` ×${qty[a.id]}` : ''}`))),
        h('span', { class: 'addons__line-price' }, money(product.price), extras.map((a) => h('small', {}, money(a.price * qty[a.id]))))),
    );
    subtotal.textContent = money(unit() * drinkQty);
    addBtn.lastChild.textContent = money(unit() * drinkQty);
    if (earn) earn.textContent = `You'll earn +${drinkQty * config.pointsPerDrink} pts`;
  }
  function render() { renderList(); renderSummary(); }

  const add = async () => {
    addToCart(product.id, qty, drinkQty);
    ov.close('added');
    await statusDialog({ icon: icons.bagCheck, title: 'Added to Order!', text: 'Your Item has been added to your order.', actionLabel: 'Continue Ordering', autoCloseMs: 2200 });
  };
  const isMember = store.get().mode === 'member';
  const earn = isMember ? h('span', { class: 'addons__earn' }) : null;
  const addBtn = h('button', { class: 'btn btn--primary btn--sm btn--block addons__add', 'data-autofocus': true, onClick: () => add() }, h('span', {}, 'Add to Order'), h('span', {}, ''));

  const body = h('div', { class: 'modal addons' },
    closeButton(() => ov.close()),
    h('div', { class: 'addons__head' },
      h('h2', { class: 'display display--md' }, 'Customize Your Add-ons'),
      h('p', { class: 'lead' }, 'Make your drink extra special.')),
    h('div', { class: 'addons__scroll scroll' },
      h('div', { class: 'addons__product' },
        h('img', { src: product.image, alt: '' }),
        h('span', { class: 'addons__product-name' }, product.name),
        h('span', { class: 'addons__product-price' }, `${php(product.price)}.00`)),
      h('h3', { class: 'addons__subtitle' }, 'Available Add-ons'),
      list,
      summary),
    h('div', { class: 'addons__foot' },
      h('div', { class: 'addons__subtotal' }, h('span', {}, 'Subtotal'), earn, subtotal),
      addBtn,
      h('button', { class: 'btn btn--outline-soft btn--sm btn--block', onClick: () => ov.close() }, 'Cancel')),
  );
  render();
  ov = openOverlay(body, { label: `Customize ${product.name}` });
}
