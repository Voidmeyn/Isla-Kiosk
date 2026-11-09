// Kiosk session state. Lives in memory only: every customer session starts clean,
// and an idle timeout or "Exit" wipes it (see resetSession).

import { productById, addonById } from '../data/menu.js';
import { config } from '../config.js';

const listeners = new Set();

const initial = () => ({
  orderType: 'dine-in',      // 'dine-in' | 'take-out'
  mode: null,                // null | 'guest' | 'member'
  user: null,                // member profile from auth service (includes points balance)
  cart: [],                  // [{ lineId, productId, qty, addons: { [addonId]: qty }, reward?: { id, name, cost } }]
  useCoupon: false,          // ₱ voucher from the member's account
  pointsToUse: 0,            // points the customer chose to spend as a discount
  paymentMethod: 'cash',     // 'card' | 'ewallet' | 'cash'
  lastOrder: null,           // receipt returned by orders service
  menuCategory: 'all',       // last category viewed (kept while this customer browses)
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

// ---------- Cart helpers ----------
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

/** Add a free reward drink (paid for with points when the order is placed). */
export function addRewardToCart(reward) {
  const lineId = `R${lineSeq++}`;
  store.set({ cart: [...state.cart, { lineId, productId: reward.productId, qty: 1, addons: {}, reward: { id: reward.id, name: reward.name, cost: reward.cost } }] });
  clampPoints();
  return lineId;
}

export function updateQty(lineId, qty) {
  if (qty <= 0) return removeLine(lineId);
  store.set({ cart: state.cart.map((l) => (l.lineId === lineId && !l.reward ? { ...l, qty: Math.min(qty, 20) } : l)) });
  clampPoints();
}

export function removeLine(lineId) {
  const cart = state.cart.filter((l) => l.lineId !== lineId);
  store.set({ cart, useCoupon: cart.some((l) => !l.reward) ? state.useCoupon : false });
  clampPoints();
}

export function clearCart() { store.set({ cart: [], useCoupon: false, pointsToUse: 0 }); }

export function lineUnitPrice(line) {
  if (line.reward) return 0;
  const p = productById(line.productId);
  const extras = Object.entries(line.addons).reduce((sum, [id, q]) => sum + (addonById(id)?.price || 0) * q, 0);
  return (p?.price || 0) + extras;
}
export const lineTotal = (line) => lineUnitPrice(line) * line.qty;
export const itemCount = (cart = state.cart) => cart.reduce((n, l) => n + l.qty, 0);
export const paidDrinkCount = (cart = state.cart) => cart.filter((l) => !l.reward).reduce((n, l) => n + l.qty, 0);

// ---------- Points ----------
export const pointsBalance = (s = state) => (s.mode === 'member' ? s.user?.points || 0 : 0);
export const rewardPointsInCart = (s = state) => s.cart.reduce((n, l) => n + (l.reward?.cost || 0), 0);

/** Largest number of points that can still be applied as a discount on this order. */
export function maxUsablePoints(s = state) {
  if (s.mode !== 'member') return 0;
  const t = baseTotals(s);
  const byBalance = pointsBalance(s) - rewardPointsInCart(s);
  const byAmount = Math.floor((t.subtotal - t.voucher) / config.pesoPerPoint);
  const max = Math.max(0, Math.min(byBalance, byAmount));
  return max - (max % config.pointsStep);
}

export function setPointsToUse(points) {
  const p = Math.max(0, Math.min(Math.floor(points / config.pointsStep) * config.pointsStep, maxUsablePoints()));
  store.set({ pointsToUse: p });
  return p;
}
function clampPoints() {
  if (state.pointsToUse > maxUsablePoints()) store.set({ pointsToUse: maxUsablePoints() });
}

function baseTotals(s) {
  const subtotal = s.cart.reduce((sum, l) => sum + lineTotal(l), 0);
  const coupon = s.mode === 'member' && s.useCoupon ? (s.user?.coupons?.[0]?.amount || 0) : 0;
  return { subtotal, voucher: Math.min(coupon, subtotal) };
}

export function totals(s = state) {
  const { subtotal, voucher } = baseTotals(s);
  const pointsUsed = s.mode === 'member' ? Math.min(s.pointsToUse, Math.max(0, pointsBalance(s) - rewardPointsInCart(s))) : 0;
  const pointsDiscount = Math.min(pointsUsed * config.pesoPerPoint, subtotal - voucher);
  const serviceFee = 0; // design shows ₱0.00 — INTEGRATION POINT: compute on the POS if fees apply
  const total = Math.max(0, subtotal - voucher - pointsDiscount + serviceFee);
  const pointsToEarn = paidDrinkCount(s.cart) * config.pointsPerDrink;
  return {
    subtotal, voucher, pointsUsed, pointsDiscount, serviceFee, total,
    discount: voucher + pointsDiscount,
    rewardPoints: rewardPointsInCart(s),
    pointsToEarn,
  };
}
