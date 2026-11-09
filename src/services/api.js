// ============================================================================
//  SERVICE LAYER — ALL BACKEND CALLS GO THROUGH THIS FILE.
//
//  Everything below is a LOCAL MOCK backed by localStorage so the kiosk is fully
//  demoable offline. Nothing here talks to a real server, and no credentials
//  exist in this codebase.
//
//  To go live, replace each function body marked  ▶ INTEGRATION POINT  with a
//  call to your real service, keeping the same inputs/outputs and throwing
//  ApiError(code, message) on failure. The screens only depend on this contract.
//
//  Suggested real services:
//    • auth / accounts  → school SSO or student-ID service (never store PINs client-side)
//    • member QR        → your mobile app issues a short-lived signed token (see qrPayload below)
//    • menu             → POS catalog (e.g. Square, Loyverse, Odoo POS) or CMS
//    • orders           → POS order API / kitchen display system
//    • payments         → card terminal SDK (cards) and GCash/Maya merchant APIs (e-wallet)
//    • rewards          → loyalty service (points ledger, vouchers, reward catalogue)
//  Configure endpoints in a backend; do not ship API keys to the kiosk browser.
// ============================================================================

import { config } from '../config.js';
import { storage } from './storage.js';
import { products, productById, addonById } from '../data/menu.js';
import { sleep } from '../core/dom.js';

export class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const DB_KEY = 'isla.mockdb.v2';
const latency = () => sleep(config.mockLatencyMs * (0.6 + Math.random() * 0.8));
const digits = (s) => String(s || '').replace(/\D/g, '');
const now = () => new Date().toISOString();

/**
 * Member QR payload format:  ISLA1:<studentId>:<memberCode>
 * MOCK ONLY. In production the Isla app should show a short-lived, signed token
 * (e.g. a JWT or HMAC over studentId + expiry) that the backend verifies, so a
 * screenshot of someone's QR stops working after a minute.
 */
export const qrPayload = (profile) => `ISLA1:${profile.studentId}:${profile.memberCode}`;

// ---------- Mock database (seeded with the account shown in the design) ----------
function seed() {
  return {
    orderSeq: 426, // next order will be IS-427, as in the design
    accounts: {
      '7230509': {
        studentId: '7230509',
        fullName: 'Ashly Nicle Mamites',
        email: 'ashly@example.edu',
        pin: '1234',          // MOCK ONLY — a real backend stores a salted hash server-side
        memberCode: '482917', // shown under the member QR, can be typed instead of scanning
        points: 250,
        coupons: [{ id: 'C20', amount: 20, label: '₱20 off voucher' }],
        history: [
          { id: 'h3', type: 'redeem', label: 'Purchased: Matcha Latte', points: -150, at: '2026-11-03T10:00:00+08:00' },
          { id: 'h2', type: 'earn', label: 'Earned Points', points: 20, at: '2026-11-02T10:00:00+08:00' },
          { id: 'h1', type: 'earn', label: 'Earned Points', points: 30, at: '2026-11-01T10:00:00+08:00' },
        ],
      },
    },
  };
}
const db = () => storage.get(DB_KEY) || (storage.set(DB_KEY, seed()), storage.get(DB_KEY));
const save = (data) => storage.set(DB_KEY, data);
export const resetMockData = () => save(seed());

const publicProfile = (a) => ({
  studentId: a.studentId,
  fullName: a.fullName,
  email: a.email,
  memberCode: a.memberCode,
  points: a.points,
  coupons: [...a.coupons],
});

function newMemberCode(data) {
  let code;
  do { code = String(100000 + Math.floor(Math.random() * 900000)); }
  while (Object.values(data.accounts).some((a) => a.memberCode === code));
  return code;
}

// ============================ AUTH ============================
export const authService = {
  /** ▶ INTEGRATION POINT: POST /auth/student-login { studentId, pin } → { token, profile } */
  async login(studentId, pin) {
    await latency();
    const acc = db().accounts[digits(studentId)];
    if (!acc || acc.pin !== pin) throw new ApiError('INVALID_CREDENTIALS', 'Student ID or PIN is incorrect.');
    return publicProfile(acc);
  },

  /** ▶ INTEGRATION POINT: POST /auth/qr { payload } → verify the signed app token → { token, profile } */
  async loginWithQr(payload) {
    await latency();
    const m = /^ISLA1:(\d{5,12}):(\d{6})$/.exec(String(payload).trim());
    if (!m) throw new ApiError('BAD_QR', 'That QR code isn’t an Isla member code.');
    const acc = db().accounts[m[1]];
    if (!acc || acc.memberCode !== m[2]) throw new ApiError('UNKNOWN_QR', 'This member QR is no longer valid. Refresh it in the Isla app.');
    return publicProfile(acc);
  },

  /** ▶ INTEGRATION POINT: POST /auth/member-code { code } (the 6 digits printed under the QR) */
  async loginWithMemberCode(code) {
    await latency();
    const acc = Object.values(db().accounts).find((a) => a.memberCode === digits(code));
    if (!acc) throw new ApiError('UNKNOWN_CODE', 'We couldn’t find that member code.');
    return publicProfile(acc);
  },

  /** ▶ INTEGRATION POINT: POST /accounts { studentId, fullName, email, pin } */
  async signup({ studentId, fullName, email, pin }) {
    await latency();
    const data = db();
    const id = digits(studentId);
    if (data.accounts[id]) throw new ApiError('ID_EXISTS', 'An account with this Student ID already exists.');
    data.accounts[id] = {
      studentId: id, fullName, email, pin, memberCode: newMemberCode(data),
      points: 0, coupons: [], history: [],
    };
    save(data);
    return publicProfile(data.accounts[id]);
  },

  /** ▶ INTEGRATION POINT: PIN reset is handled by staff/registrar in this design. */
  async requestPinReset() { await latency(); return { handledBy: 'counter' }; },
};

// ============================ MENU ============================
export const menuService = {
  /** ▶ INTEGRATION POINT: GET /menu → products with availability. Mock returns local data. */
  async getCatalog() {
    return products;
  },
};

// ============================ PAYMENTS ============================
export const paymentService = {
  /**
   * ▶ INTEGRATION POINT
   *  card    → card-terminal SDK: create a payment intent, wait for tap/insert, return approval code
   *  ewallet → GCash / Maya merchant API: create a dynamic QR, poll/webhook until paid
   *  cash    → no charge; order is marked "pay at counter"
   * Mock: waits, then succeeds (or fails at config.mockPaymentFailureRate).
   */
  async charge({ method, amount }) {
    if (method === 'cash' || amount <= 0) return { status: amount <= 0 ? 'paid' : 'pending', method, reference: null };
    await sleep(2200 + Math.random() * 800);
    if (Math.random() < config.mockPaymentFailureRate) {
      throw new ApiError('PAYMENT_DECLINED', method === 'card' ? 'Your card was declined.' : 'The e-wallet payment was not completed.');
    }
    return { status: 'paid', method, reference: `MOCK-${Date.now().toString(36).toUpperCase()}` };
  },
};

// ============================ ORDERS ============================
export const orderService = {
  /**
   * ▶ INTEGRATION POINT: POST /orders → POS / kitchen display; returns the queue number.
   * The loyalty side (points used, rewards redeemed, points earned) must be applied
   * atomically with the order on the server.
   */
  async place({ cart, orderType, payment, totals, user, couponId }) {
    await latency();
    const data = db();
    data.orderSeq += 1;
    const orderNumber = `IS-${data.orderSeq}`;
    let pointsEarned = 0;
    let pointsUsed = 0;
    let rewardsCost = 0;

    if (user) {
      const acc = data.accounts[user.studentId];
      if (!acc) throw new ApiError('NOT_FOUND', 'Member account not found.');
      rewardsCost = cart.reduce((n, l) => n + (l.reward?.cost || 0), 0);
      pointsUsed = totals.pointsUsed || 0;
      if (acc.points < rewardsCost + pointsUsed) {
        throw new ApiError('INSUFFICIENT_POINTS', 'You no longer have enough points for the rewards in this order.');
      }
      pointsEarned = cart.filter((l) => !l.reward).reduce((n, l) => n + l.qty, 0) * config.pointsPerDrink;
      acc.points = acc.points - rewardsCost - pointsUsed + pointsEarned;
      if (couponId) acc.coupons = acc.coupons.filter((c) => c.id !== couponId);
      const at = now();
      cart.filter((l) => l.reward).forEach((l) =>
        acc.history.unshift({ id: `h${Date.now()}${l.lineId}`, type: 'redeem', label: `Redeemed: ${l.reward.name}`, points: -l.reward.cost, at }));
      if (pointsUsed) acc.history.unshift({ id: `h${Date.now()}u`, type: 'redeem', label: `Points discount · ${orderNumber}`, points: -pointsUsed, at });
      if (pointsEarned) acc.history.unshift({ id: `h${Date.now()}e`, type: 'earn', label: `Earned Points · ${orderNumber}`, points: pointsEarned, at });
    }
    save(data);

    return {
      orderNumber,
      etaText: 'Ready in about 8 to 10 minutes',
      orderType,
      payment,
      totals,
      pointsEarned,
      pointsUsed,
      rewardsCost,
      lines: cart.map((l) => ({
        name: productById(l.productId)?.name,
        qty: l.qty,
        reward: l.reward ? l.reward.cost : null,
        amount: l.reward ? 0 : l.qty * ((productById(l.productId)?.price || 0) +
          Object.entries(l.addons).reduce((s, [id, q]) => s + (addonById(id)?.price || 0) * q, 0)),
        addons: Object.entries(l.addons).map(([id, q]) => `${addonById(id)?.name}${q > 1 ? ` ×${q}` : ''}`),
      })),
      placedAt: now(),
      profile: user ? publicProfile(data.accounts[user.studentId]) : null,
    };
  },
};

// ============================ REWARDS ============================
export const REWARD_CATALOG = [
  { id: 'r-caramel', productId: 'caramel-latte', name: 'Caramel Latte', cost: 100 },
  { id: 'r-java', productId: 'java-chips', name: 'Java Chip', cost: 100 },
  { id: 'r-matcha', productId: 'matcha-latte', name: 'Matcha Latte', cost: 150 },
  { id: 'r-spanish', productId: 'spanish-latte', name: 'Spanish Latte', cost: 150 },
  { id: 'r-ube', productId: 'ube-dream', name: 'Ube Dream', cost: 200 },
].map((r) => ({ ...r, image: `assets/img/drinks/${r.productId}.webp` }));

export const rewardsService = {
  /** ▶ INTEGRATION POINT: GET /loyalty/{studentId} */
  async getSummary(studentId) {
    await latency();
    const acc = db().accounts[studentId];
    if (!acc) throw new ApiError('NOT_FOUND', 'Account not found.');
    return {
      profile: publicProfile(acc),
      nextReward: { name: 'Free ISLA Signature Latte', target: 400 },
      catalog: REWARD_CATALOG,
      history: acc.history.slice(0, 20),
    };
  },
};

// ============================ STAFF ============================
export const staffService = {
  /** ▶ INTEGRATION POINT: POST /loyalty/{studentId}/adjust { points, reason } — staff-authenticated. */
  async addPoints(studentId, points, reason = 'Added by staff') {
    await latency();
    const data = db();
    const acc = data.accounts[digits(studentId)];
    if (!acc) throw new ApiError('NOT_FOUND', 'No member with that Student ID.');
    acc.points = Math.max(0, acc.points + points);
    acc.history.unshift({ id: `h${Date.now()}s`, type: points >= 0 ? 'earn' : 'redeem', label: reason, points, at: now() });
    save(data);
    return publicProfile(acc);
  },
};
