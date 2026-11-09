


import { productById, addonById } from '../data/menu.js';
import { config } from '../config.js';

const listeners = new Set();

const initial = () => ({
  orderType: 'dine-in',
  mode: null,
  user: null,
  cart: [],
  useCoupon: false,
  paymentMethod: 'cash',
  lastOrder: null,
  menuCategory: 'all',
});

let state = initial();
let lineSeq = 1;

export const store = {
  get: () => state,
  set(patch) {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    listeners.forEach((fn) => fn(state));
  },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

export function resetSession() {
  state = initial();
  listeners.forEach((fn) => fn(state));
}


const addonKey = (addons) => JSON.stringify(Object.entries(addons).filter(([, q]) => q > 0).sort());

export function addToCart(productId, addons = {}, qty = 1) {
  const clean = Object.fromEntries(Object.entries(addons).filter(([, q]) => q > 0));
  const existing = state.cart.find((l) => !l.reward && l.productId === productId && addonKey(l.addons) === addonKey(clean));
  if (existing) {
    updateQty(existing.lineId, existing.qty + qty);
    return existing.lineId;
  }
  const lineId = `L${lineSeq++}`;
  store.set({ cart: [...state.cart, { lineId, productId, qty, addons: clean }] });
  return lineId;
}


export function addRewardToCart(reward) {
  const lineId = `R${lineSeq++}`;
  store.set({ cart: [...state.cart, { lineId, productId: reward.productId, qty: 1, addons: {}, reward: { id: reward.id, name: reward.name, cost: reward.cost } }] });
  return lineId;
}

export function updateQty(lineId, qty) {
  if (qty <= 0) return removeLine(lineId);
  store.set({ cart: state.cart.map((l) => (l.lineId === lineId && !l.reward ? { ...l, qty: Math.min(qty, 20) } : l)) });
}

export function removeLine(lineId) {
  const cart = state.cart.filter((l) => l.lineId !== lineId);
  store.set({ cart, useCoupon: cart.some((l) => !l.reward) ? state.useCoupon : false });
}

export function clearCart() { store.set({ cart: [], useCoupon: false }); }

export function lineUnitPrice(line) {
  if (line.reward) return 0;
  const p = productById(line.productId);
  const extras = Object.entries(line.addons).reduce((sum, [id, q]) => sum + (addonById(id)?.price || 0) * q, 0);
  return (p?.price || 0) + extras;
}
export const lineTotal = (line) => lineUnitPrice(line) * line.qty;
export const itemCount = (cart = state.cart) => cart.reduce((n, l) => n + l.qty, 0);
export const paidDrinkCount = (cart = state.cart) => cart.filter((l) => !l.reward).reduce((n, l) => n + l.qty, 0);


export const pointsBalance = (s = state) => (s.mode === 'member' ? s.user?.points || 0 : 0);
export const rewardPointsInCart = (s = state) => s.cart.reduce((n, l) => n + (l.reward?.cost || 0), 0);


function baseTotals(s) {
  const subtotal = s.cart.reduce((sum, l) => sum + lineTotal(l), 0);
  const coupon = s.mode === 'member' && s.useCoupon ? (s.user?.coupons?.[0]?.amount || 0) : 0;
  return { subtotal, voucher: Math.min(coupon, subtotal) };
}

export function totals(s = state) {
  const { subtotal, voucher } = baseTotals(s);
  const serviceFee = 0;
  const total = Math.max(0, subtotal - voucher + serviceFee);
  const pointsToEarn = paidDrinkCount(s.cart) * config.pointsPerDrink;
  return {
    subtotal, voucher, serviceFee, total,
    discount: voucher,
    rewardPoints: rewardPointsInCart(s),
    pointsToEarn,
  };
}
