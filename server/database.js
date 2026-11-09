const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const databasePath = process.env.ISLA_DB_PATH || path.join(__dirname, '..', 'storage', 'isla-kiosk.sqlite');
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS accounts (
    student_id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    pin_salt TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    member_code TEXT NOT NULL UNIQUE,
    points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES accounts(student_id) ON DELETE CASCADE,
    amount INTEGER NOT NULL CHECK (amount >= 0),
    label TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS points_history (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES accounts(student_id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('earn', 'redeem')),
    label TEXT NOT NULL,
    points INTEGER NOT NULL,
    at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    student_id TEXT REFERENCES accounts(student_id),
    order_type TEXT NOT NULL CHECK (order_type IN ('dine-in', 'take-out')),
    payment_json TEXT NOT NULL,
    totals_json TEXT NOT NULL,
    lines_json TEXT NOT NULL,
    placed_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS member_sessions (
    token_hash TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES accounts(student_id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kiosk_sessions (
    token_hash TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES accounts(student_id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS staff_sessions (
    token_hash TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kiosk_qr_sessions (
    id TEXT PRIMARY KEY,
    challenge_hash TEXT NOT NULL UNIQUE,
    poll_hash TEXT NOT NULL,
    kiosk_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'cancelled', 'expired')),
    student_id TEXT REFERENCES accounts(student_id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    approved_at TEXT,
    claimed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS points_history_student_id ON points_history(student_id);
  CREATE INDEX IF NOT EXISTS orders_student_id ON orders(student_id, id);
  CREATE INDEX IF NOT EXISTS member_sessions_expires_at ON member_sessions(expires_at);
  CREATE INDEX IF NOT EXISTS kiosk_sessions_expires_at ON kiosk_sessions(expires_at);
  CREATE INDEX IF NOT EXISTS staff_sessions_expires_at ON staff_sessions(expires_at);
  CREATE INDEX IF NOT EXISTS kiosk_qr_sessions_expires_at ON kiosk_qr_sessions(expires_at);
`);

class ApiError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const now = () => new Date().toISOString();
const digits = (value) => String(value || '').replace(/\D/g, '');
const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const addMilliseconds = (date, milliseconds) => new Date(date.getTime() + milliseconds).toISOString();
const POINTS_PER_PAID_DRINK = 10;
const rewardCatalog = new Map([
  ['r-caramel', { productId: 'caramel-latte', productName: 'Caramel Latte', name: 'Caramel Latte', cost: 100 }],
  ['r-java', { productId: 'java-chips', productName: 'Java Chips', name: 'Java Chip', cost: 100 }],
  ['r-matcha', { productId: 'matcha-latte', productName: 'Matcha Latte', name: 'Matcha Latte', cost: 150 }],
  ['r-spanish', { productId: 'spanish-latte', productName: 'Spanish Latte', name: 'Spanish Latte', cost: 150 }],
  ['r-ube', { productId: 'ube-dream', productName: 'Ube Dream', name: 'Ube Dream', cost: 200 }],
]);
const profileFor = (studentId) => {
  const account = database.prepare('SELECT student_id, full_name, email, points FROM accounts WHERE student_id = ?').get(studentId);
  if (!account) return null;
  const coupons = database.prepare('SELECT id, amount, label FROM coupons WHERE student_id = ? ORDER BY rowid').all(studentId);
  return {
    studentId: account.student_id,
    fullName: account.full_name,
    email: account.email,
    points: account.points,
    coupons,
  };
};

const newMemberCode = () => {
  let code;
  do {
    code = String(crypto.randomInt(100000, 1000000));
  } while (database.prepare('SELECT 1 FROM accounts WHERE member_code = ?').get(code));
  return code;
};

function transaction(fn) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

function validateAccount({ studentId, fullName, email, pin }) {
  const id = digits(studentId);
  if (id.length < 5 || id.length > 12) throw new ApiError('INVALID_STUDENT_ID', 'Enter a valid Student ID.');
  if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.length > 80) {
    throw new ApiError('INVALID_NAME', 'Enter your full name.');
  }
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new ApiError('INVALID_EMAIL', 'Enter a valid email address.');
  }
  if (typeof pin !== 'string' || !/^\d{4,6}$/.test(pin)) throw new ApiError('INVALID_PIN', 'PIN must be 4–6 digits.');
  return { id, fullName: fullName.trim(), email: email.trim().toLowerCase(), pin };
}

function createAccount(input) {
  const account = validateAccount(input);
  if (database.prepare('SELECT 1 FROM accounts WHERE student_id = ?').get(account.id)) {
    throw new ApiError('ID_EXISTS', 'An account with this Student ID already exists.', 409);
  }
  if (database.prepare('SELECT 1 FROM accounts WHERE email = ?').get(account.email)) {
    throw new ApiError('EMAIL_EXISTS', 'An account with this email address already exists.', 409);
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const pinHash = crypto.scryptSync(account.pin, salt, 64).toString('hex');
  const memberCode = newMemberCode();
  database.prepare(`
    INSERT INTO accounts (student_id, full_name, email, pin_salt, pin_hash, member_code, points, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(account.id, account.fullName, account.email, salt, pinHash, memberCode, now());
  return profileFor(account.id);
}

function login({ studentId, pin }) {
  const id = digits(studentId);
  const account = database.prepare('SELECT pin_salt, pin_hash FROM accounts WHERE student_id = ?').get(id);
  const candidate = crypto.scryptSync(String(pin || ''), account?.pin_salt || 'unknown-account-salt', 64);
  const expected = account ? Buffer.from(account.pin_hash, 'hex') : Buffer.alloc(64);
  if (!account || !crypto.timingSafeEqual(candidate, expected)) {
    throw new ApiError('INVALID_CREDENTIALS', 'Student ID or PIN is incorrect.', 401);
  }
  return profileFor(id);
}

function createMemberSession(studentId) {
  const token = randomToken();
  const created = new Date();
  database.prepare('INSERT INTO member_sessions (token_hash, student_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(tokenHash(token), studentId, created.toISOString(), addMilliseconds(created, 30 * 24 * 60 * 60 * 1000));
  return token;
}

function getMemberSession(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const hash = tokenHash(token);
  const session = database.prepare('SELECT student_id, expires_at FROM member_sessions WHERE token_hash = ?').get(hash);
  if (!session) return null;
  if (session.expires_at <= now()) {
    database.prepare('DELETE FROM member_sessions WHERE token_hash = ?').run(hash);
    return null;
  }
  const expiresAt = addMilliseconds(new Date(), 30 * 24 * 60 * 60 * 1000);
  database.prepare('UPDATE member_sessions SET expires_at = ? WHERE token_hash = ?').run(expiresAt, hash);
  return profileFor(session.student_id);
}

function revokeMemberSession(token) {
  if (typeof token === 'string' && /^[A-Za-z0-9_-]{40,50}$/.test(token)) {
    database.prepare('DELETE FROM member_sessions WHERE token_hash = ?').run(tokenHash(token));
  }
}

function createKioskSession(studentId) {
  const token = randomToken();
  const created = new Date();
  database.prepare('INSERT INTO kiosk_sessions (token_hash, student_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(tokenHash(token), studentId, created.toISOString(), addMilliseconds(created, 12 * 60 * 60 * 1000));
  return token;
}

function getKioskSession(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const hash = tokenHash(token);
  const session = database.prepare('SELECT student_id, expires_at FROM kiosk_sessions WHERE token_hash = ?').get(hash);
  if (!session) return null;
  if (session.expires_at <= now()) {
    database.prepare('DELETE FROM kiosk_sessions WHERE token_hash = ?').run(hash);
    return null;
  }
  const expiresAt = addMilliseconds(new Date(), 12 * 60 * 60 * 1000);
  database.prepare('UPDATE kiosk_sessions SET expires_at = ? WHERE token_hash = ?').run(expiresAt, hash);
  return profileFor(session.student_id);
}

function revokeKioskSession(token) {
  if (typeof token === 'string' && /^[A-Za-z0-9_-]{40,50}$/.test(token)) {
    database.prepare('DELETE FROM kiosk_sessions WHERE token_hash = ?').run(tokenHash(token));
  }
}

function createStaffSession() {
  const token = randomToken();
  const created = new Date();
  database.prepare('INSERT INTO staff_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash(token), created.toISOString(), addMilliseconds(created, 15 * 60 * 1000));
  return token;
}

function isStaffSessionValid(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,50}$/.test(token)) return false;
  const hash = tokenHash(token);
  const session = database.prepare('SELECT expires_at FROM staff_sessions WHERE token_hash = ?').get(hash);
  if (!session) return false;
  if (session.expires_at <= now()) {
    database.prepare('DELETE FROM staff_sessions WHERE token_hash = ?').run(hash);
    return false;
  }
  return true;
}

function revokeStaffSession(token) {
  if (typeof token === 'string' && /^[A-Za-z0-9_-]{40,50}$/.test(token)) {
    database.prepare('DELETE FROM staff_sessions WHERE token_hash = ?').run(tokenHash(token));
  }
}

function expireKioskSessions() {
  const current = now();
  database.prepare("UPDATE kiosk_qr_sessions SET status = 'expired' WHERE status = 'pending' AND expires_at <= ?").run(current);
  database.prepare("DELETE FROM kiosk_qr_sessions WHERE expires_at <= ?").run(addMilliseconds(new Date(), -24 * 60 * 60 * 1000));
  database.prepare('DELETE FROM member_sessions WHERE expires_at <= ?').run(current);
  database.prepare('DELETE FROM kiosk_sessions WHERE expires_at <= ?').run(current);
  database.prepare('DELETE FROM staff_sessions WHERE expires_at <= ?').run(current);
}

function createKioskQrSession({ kioskName = 'Isla Kiosk' } = {}) {
  expireKioskSessions();
  const id = crypto.randomUUID();
  const challenge = randomToken();
  const pollToken = randomToken();
  const created = new Date();
  const expiresAt = addMilliseconds(created, 2 * 60 * 1000);
  const name = typeof kioskName === 'string' ? kioskName.trim().slice(0, 60) : '';
  database.prepare(`
    INSERT INTO kiosk_qr_sessions (id, challenge_hash, poll_hash, kiosk_name, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, tokenHash(challenge), tokenHash(pollToken), name || 'Isla Kiosk', created.toISOString(), expiresAt);
  return { id, challenge, pollToken, kioskName: name || 'Isla Kiosk', expiresAt };
}

function getKioskQrStatus({ id, pollToken }) {
  expireKioskSessions();
  if (typeof id !== 'string' || typeof pollToken !== 'string') throw new ApiError('INVALID_SESSION', 'This QR login session is invalid.', 400);
  const session = database.prepare('SELECT * FROM kiosk_qr_sessions WHERE id = ?').get(id);
  if (!session || session.poll_hash !== tokenHash(pollToken)) throw new ApiError('INVALID_SESSION', 'This QR login session is invalid or has expired.', 404);
  const result = { status: session.status, expiresAt: session.expires_at };
  if (session.status === 'approved' && session.student_id && !session.claimed_at) {
    const claimedAt = now();
    const claimed = database.prepare(`
      UPDATE kiosk_qr_sessions SET claimed_at = ?
      WHERE id = ? AND poll_hash = ? AND status = 'approved' AND claimed_at IS NULL
    `).run(claimedAt, id, tokenHash(pollToken));
    if (claimed.changes === 1) result.profile = profileFor(session.student_id);
    else result.status = 'claimed';
  } else if (session.claimed_at) result.status = 'claimed';
  return result;
}

function getKioskQrDetails({ challenge }) {
  if (typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{40,50}$/.test(challenge)) {
    throw new ApiError('INVALID_QR_SESSION', 'This kiosk QR code is invalid or has expired.', 400);
  }
  expireKioskSessions();
  const session = database.prepare('SELECT kiosk_name, status, expires_at FROM kiosk_qr_sessions WHERE challenge_hash = ?')
    .get(tokenHash(challenge));
  if (!session) throw new ApiError('INVALID_QR_SESSION', 'This kiosk QR code is invalid or has expired.', 404);
  return { kioskName: session.kiosk_name, status: session.status, expiresAt: session.expires_at };
}

function approveKioskQr({ challenge }, studentId) {
  expireKioskSessions();
  if (typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{40,50}$/.test(challenge)) {
    throw new ApiError('INVALID_QR_SESSION', 'This kiosk QR code is invalid or has expired.', 400);
  }
  return transaction(() => {
    const updated = database.prepare(`
      UPDATE kiosk_qr_sessions SET status = 'approved', student_id = ?, approved_at = ?
      WHERE challenge_hash = ? AND status = 'pending' AND expires_at > ?
    `).run(studentId, now(), tokenHash(challenge), now());
    if (updated.changes !== 1) throw new ApiError('QR_SESSION_EXPIRED', 'This kiosk QR code has expired or was already used.', 409);
    return { approved: true };
  });
}

function cancelKioskQr({ challenge }) {
  if (typeof challenge !== 'string' || !/^[A-Za-z0-9_-]{40,50}$/.test(challenge)) {
    throw new ApiError('INVALID_QR_SESSION', 'This kiosk QR code is invalid or has expired.', 400);
  }
  const result = database.prepare(`
    UPDATE kiosk_qr_sessions SET status = 'cancelled'
    WHERE challenge_hash = ? AND status = 'pending' AND expires_at > ?
  `).run(tokenHash(challenge), now());
  if (result.changes !== 1) throw new ApiError('QR_SESSION_EXPIRED', 'This kiosk QR code has expired or was already used.', 409);
  return { cancelled: true };
}

function cancelKioskQrSession({ id, pollToken }) {
  if (typeof id !== 'string' || typeof pollToken !== 'string') throw new ApiError('INVALID_SESSION', 'This QR login session is invalid.', 400);
  const result = database.prepare(`
    UPDATE kiosk_qr_sessions SET status = 'cancelled'
    WHERE id = ? AND poll_hash = ? AND status = 'pending'
  `).run(id, tokenHash(pollToken));
  if (result.changes !== 1) throw new ApiError('INVALID_SESSION', 'This QR login session is no longer active.', 409);
  return { cancelled: true };
}

function getSummary({ studentId }, context) {
  if (!context?.kioskStudentId || context.kioskStudentId !== digits(studentId)) {
    throw new ApiError('UNAUTHORIZED', 'Please sign in again to access rewards.', 401);
  }
  const profile = profileFor(context.kioskStudentId);
  if (!profile) throw new ApiError('NOT_FOUND', 'Account not found.', 404);
  const history = database.prepare(`
    SELECT id, type, label, points, at FROM points_history
    WHERE student_id = ? ORDER BY rowid DESC LIMIT 20
  `).all(profile.studentId);
  return { profile, history };
}

function addPoints({ studentId, points, reason = 'Added by staff' }, context) {
  if (!context?.staffAuthorized) throw new ApiError('UNAUTHORIZED', 'Staff sign-in is required.', 401);
  const id = digits(studentId);
  const amount = Number(points);
  if (!Number.isSafeInteger(amount) || amount === 0 || Math.abs(amount) > 100000) {
    throw new ApiError('INVALID_POINTS', 'Enter a valid points amount.');
  }
  return transaction(() => {
    const account = database.prepare('SELECT points FROM accounts WHERE student_id = ?').get(id);
    if (!account) throw new ApiError('NOT_FOUND', 'No member with that Student ID.', 404);
    const next = Math.max(0, account.points + amount);
    database.prepare('UPDATE accounts SET points = ? WHERE student_id = ?').run(next, id);
    database.prepare(`
      INSERT INTO points_history (id, student_id, type, label, points, at) VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), id, amount >= 0 ? 'earn' : 'redeem', String(reason).slice(0, 120), next - account.points, now());
    return profileFor(id);
  });
}

function placeOrder({ cart, orderType, payment, totals, user, couponId }, context) {
  if (!Array.isArray(cart) || !cart.length || cart.length > 100) throw new ApiError('INVALID_ORDER', 'Your order has no items.');
  if (!['dine-in', 'take-out'].includes(orderType)) throw new ApiError('INVALID_ORDER', 'Choose dine-in or take-out.');
  if (!payment || typeof payment.method !== 'string' || !totals || typeof totals.total !== 'number') {
    throw new ApiError('INVALID_ORDER', 'The order details are invalid.');
  }
  if (cart.some((line) => line?.reward) && !user) {
    throw new ApiError('MEMBER_REQUIRED', 'Sign in to redeem reward drinks.', 401);
  }
  const lines = cart.map((line) => {
    if (!line || typeof line.name !== 'string' || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > 20 ||
      typeof line.amount !== 'number' || !Array.isArray(line.addons)) {
      throw new ApiError('INVALID_ORDER', 'An item in your order is invalid.');
    }
    let reward = null;
    if (line.reward != null) {
      reward = rewardCatalog.get(line.reward.id);
      if (!reward || line.reward.name !== reward.name || Number(line.reward.cost) !== reward.cost ||
        line.productId !== reward.productId || line.name !== reward.productName || line.qty !== 1 ||
        line.amount !== 0 || line.addons.length) {
        throw new ApiError('INVALID_REWARD', 'This reward is not valid. Choose a drink from the rewards catalog.', 400);
      }
    }
    return {
      name: line.name.slice(0, 100),
      qty: line.qty,
      reward: reward?.cost || null,
      amount: reward ? 0 : Math.max(0, Math.round(line.amount * 100) / 100),
      addons: line.addons.filter((addon) => typeof addon === 'string').slice(0, 20).map((addon) => addon.slice(0, 100)),
    };
  });
  const safeTotals = {
    subtotal: Number(totals.subtotal) || 0,
    voucher: Number(totals.voucher) || 0,
    serviceFee: Number(totals.serviceFee) || 0,
    total: Math.max(0, Number(totals.total) || 0),
    discount: Number(totals.voucher) || 0,
  };
  if (user && !context?.kioskStudentId) throw new ApiError('UNAUTHORIZED', 'Please sign in again before placing this member order.', 401);
  if (user && digits(user.studentId) !== context.kioskStudentId) throw new ApiError('UNAUTHORIZED', 'The signed-in account does not match this order.', 401);
  const studentId = user ? context.kioskStudentId : null;
  const rewardsCost = lines.reduce((sum, line) => sum + (line.reward || 0), 0);
  const pointsEarned = user ? cart.filter((line) => !line.reward).reduce((sum, line) => sum + line.qty, 0) * POINTS_PER_PAID_DRINK : 0;
  const placedAt = now();

  return transaction(() => {
    let updatedProfile = null;
    let actualRewardsCost = 0;
    if (studentId) {
      const account = database.prepare('SELECT points FROM accounts WHERE student_id = ?').get(studentId);
      if (!account) throw new ApiError('NOT_FOUND', 'Member account not found.', 404);
      actualRewardsCost = rewardsCost;
      if (account.points < actualRewardsCost) {
        throw new ApiError('INSUFFICIENT_POINTS', 'You no longer have enough points for the rewards in this order.', 409);
      }
      const earned = pointsEarned;
      database.prepare('UPDATE accounts SET points = ? WHERE student_id = ?')
        .run(account.points - actualRewardsCost + earned, studentId);
      if (couponId) database.prepare('DELETE FROM coupons WHERE id = ? AND student_id = ?').run(couponId, studentId);
      const insertHistory = database.prepare(`
        INSERT INTO points_history (id, student_id, type, label, points, at) VALUES (?, ?, ?, ?, ?, ?)
      `);
      cart.filter((line) => line.reward).forEach((line) => insertHistory.run(
        crypto.randomUUID(), studentId, 'redeem', `Redeemed: ${line.reward.name}`, -line.reward.cost, placedAt));
      if (earned) insertHistory.run(
        crypto.randomUUID(), studentId, 'earn', 'Earned Points', earned, placedAt);
      updatedProfile = profileFor(studentId);
    }
    const nextOrderId = database.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM orders').get().id;
    const orderNumber = `IS-${425 + nextOrderId}`;
    database.prepare(`
      INSERT INTO orders (order_number, student_id, order_type, payment_json, totals_json, lines_json, placed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(orderNumber, studentId, orderType, JSON.stringify(payment), JSON.stringify(safeTotals), JSON.stringify(lines), placedAt);
    return {
      orderNumber,
      etaText: 'Ready in about 8 to 10 minutes',
      orderType,
      payment,
      totals: safeTotals,
      pointsEarned,
      rewardsCost: actualRewardsCost,
      lines,
      placedAt,
      profile: updatedProfile,
    };
  });
}

function dispatch(action, payload, context = {}) {
  switch (action) {
    case 'auth.login': return login(payload);
    case 'auth.signup': return createAccount(payload);
    case 'auth.requestPinReset': return { handledBy: 'counter' };
    case 'rewards.getSummary': return getSummary(payload, context);
    case 'staff.addPoints': return addPoints(payload, context);
    case 'orders.place': return placeOrder(payload, context);
    default: throw new ApiError('NOT_FOUND', 'API route not found.', 404);
  }
}

module.exports = {
  dispatch,
  createMemberSession,
  getMemberSession,
  revokeMemberSession,
  createKioskSession,
  getKioskSession,
  revokeKioskSession,
  createStaffSession,
  isStaffSessionValid,
  revokeStaffSession,
  createKioskQrSession,
  getKioskQrStatus,
  getKioskQrDetails,
  approveKioskQr,
  cancelKioskQr,
  cancelKioskQrSession,
};
