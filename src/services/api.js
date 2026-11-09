import { config } from '../config.js';
import { products, productById, addonById } from '../data/menu.js';
import { sleep } from '../core/dom.js';

export class ApiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const latency = () => sleep(config.mockLatencyMs * (0.6 + Math.random() * 0.8));

async function request(action, payload = {}) {
  let response;
  try {
    response = await fetch('/api', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
  } catch {
    throw new ApiError('SERVER_UNAVAILABLE', 'The kiosk database is unavailable. Please try again.');
  }
  const result = await response.json();
  if (!response.ok) {
    throw new ApiError(result.error?.code || 'REQUEST_FAILED', result.error?.message || 'The request could not be completed.');
  }
  return result.data;
}

export async function endpoint(path, { method = 'POST', payload, headers = {} } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: { ...(payload === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
  } catch {
    throw new ApiError('SERVER_UNAVAILABLE', 'The kiosk server is unavailable. Please try again.');
  }
  const result = await response.json();
  if (!response.ok) {
    throw new ApiError(result.error?.code || 'REQUEST_FAILED', result.error?.message || 'The request could not be completed.');
  }
  return result.data;
}

export const authService = {
  async login(studentId, pin) {
    await latency();
    return request('auth.login', { studentId, pin });
  },

  async signup(account) {
    await latency();
    return request('auth.signup', account);
  },

  async requestPinReset() {
    await latency();
    return request('auth.requestPinReset');
  },

  async logout() {
    await endpoint('/api/kiosk/logout');
  },
};

export const kioskQrService = {
  create() {
    return endpoint('/api/kiosk/qr-session', { payload: { kioskName: config.storeName } });
  },
  poll({ id, pollToken }) {
    return endpoint(`/api/kiosk/qr-session/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { 'x-kiosk-poll-token': pollToken },
    });
  },
  cancel({ id, pollToken }) {
    return endpoint(`/api/kiosk/qr-session/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-kiosk-poll-token': pollToken },
    });
  },
};

export const memberWebService = {
  session() {
    return endpoint('/api/member/session', { method: 'GET' });
  },
  login(studentId, pin) {
    return endpoint('/api/member/login', { payload: { studentId, pin } });
  },
  logout() {
    return endpoint('/api/member/logout');
  },
  approve(challenge) {
    return endpoint('/api/member/kiosk-approve', { payload: { challenge } });
  },
  cancel(challenge) {
    return endpoint('/api/member/kiosk-cancel', { payload: { challenge } });
  },
};

export const menuService = {
  async getCatalog() {
    return products;
  },
};

export const paymentService = {
  async charge({ method, amount }) {
    if (method === 'cash' || amount <= 0) return { status: amount <= 0 ? 'paid' : 'pending', method, reference: null };
    await sleep(2200 + Math.random() * 800);
    if (Math.random() < config.mockPaymentFailureRate) {
      throw new ApiError('PAYMENT_DECLINED', method === 'card' ? 'Your card was declined.' : 'The e-wallet payment was not completed.');
    }
    return { status: 'paid', method, reference: `DEMO-${Date.now().toString(36).toUpperCase()}`, simulated: true };
  },
};

export const orderService = {
  async place({ cart, orderType, payment, totals, user, couponId }) {
    await latency();
    const lines = cart.map((line) => ({
      productId: line.productId,
      name: productById(line.productId)?.name || 'Unknown item',
      qty: line.qty,
      reward: line.reward ? { id: line.reward.id, name: line.reward.name, cost: line.reward.cost } : null,
      amount: line.reward ? 0 : line.qty * ((productById(line.productId)?.price || 0) +
        Object.entries(line.addons).reduce((sum, [id, quantity]) => sum + (addonById(id)?.price || 0) * quantity, 0)),
      addons: Object.entries(line.addons).map(([id, quantity]) =>
        `${addonById(id)?.name || 'Add-on'}${quantity > 1 ? ` ×${quantity}` : ''}`),
    }));
    return request('orders.place', {
      cart: lines, orderType, payment, totals, user, couponId,
    });
  },
};

export const REWARD_CATALOG = [
  { id: 'r-caramel', productId: 'caramel-latte', name: 'Caramel Latte', cost: 100 },
  { id: 'r-java', productId: 'java-chips', name: 'Java Chip', cost: 100 },
  { id: 'r-matcha', productId: 'matcha-latte', name: 'Matcha Latte', cost: 150 },
  { id: 'r-spanish', productId: 'spanish-latte', name: 'Spanish Latte', cost: 150 },
  { id: 'r-ube', productId: 'ube-dream', name: 'Ube Dream', cost: 200 },
].map((reward) => ({ ...reward, image: `assets/img/drinks/${reward.productId}.webp` }));

export const rewardsService = {
  async getSummary(studentId) {
    await latency();
    const summary = await request('rewards.getSummary', { studentId });
    const nextReward = REWARD_CATALOG.find((reward) => reward.cost > summary.profile.points);
    return {
      ...summary,
      nextReward: nextReward || null,
      catalog: REWARD_CATALOG,
    };
  },
};

export const staffService = {
  async login(pin) {
    return endpoint('/api/staff/login', { payload: { pin } });
  },

  async logout() {
    return endpoint('/api/staff/logout');
  },

  async addPoints(studentId, points, reason = 'Added by staff') {
    await latency();
    return request('staff.addPoints', { studentId, points, reason });
  },
};
