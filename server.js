#!/usr/bin/env node





const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const database = require('./server/database.js');
const { dispatch } = database;
const root = __dirname;
const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || '127.0.0.1';
const publicBaseUrl = process.env.PUBLIC_BASE_URL ? new URL(process.env.PUBLIC_BASE_URL) : null;
if (publicBaseUrl && !['http:', 'https:'].includes(publicBaseUrl.protocol)) throw new Error('PUBLIC_BASE_URL must use HTTP or HTTPS.');
if (publicBaseUrl && (publicBaseUrl.username || publicBaseUrl.password || publicBaseUrl.pathname !== '/' || publicBaseUrl.search || publicBaseUrl.hash)) {
  throw new Error('PUBLIC_BASE_URL must be an origin without credentials, path, query, or fragment.');
}
if (process.env.NODE_ENV === 'production' && (!publicBaseUrl || publicBaseUrl.protocol !== 'https:')) {
  throw new Error('Production requires PUBLIC_BASE_URL to be an HTTPS URL.');
}
if (process.env.NODE_ENV === 'production' && (!process.env.ISLA_STAFF_PIN || process.env.ISLA_STAFF_PIN.length < 8)) {
  throw new Error('Production requires ISLA_STAFF_PIN to be at least 8 characters long.');
}
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const blocked = /^\/(kiosk|tools|node_modules|\.git)(\/|$)/;
const rateLimits = new Map();
const cookieNames = {
  member: 'isla_member_session',
  kiosk: 'isla_kiosk_session',
  staff: 'isla_staff_session',
};

function requestIsSecure(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return Boolean(req.socket.encrypted || (process.env.TRUST_PROXY === '1' && forwardedProto === 'https'));
}

function originFor(req) {
  if (publicBaseUrl) return publicBaseUrl.origin;
  const scheme = requestIsSecure(req) ? 'https' : 'http';
  return `${scheme}://${req.headers.host}`;
}

function cookieValue(req, name) {
  const item = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? item.slice(name.length + 1) : '';
}

function setCookie(req, res, name, token, maxAge) {
  const secure = requestIsSecure(req) || process.env.NODE_ENV === 'production';
  res.setHeader('set-cookie', `${name}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`);
}

function clearCookie(req, res, name) {
  const secure = requestIsSecure(req) || process.env.NODE_ENV === 'production';
  res.setHeader('set-cookie', `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`);
}

function checkOrigin(req) {
  const origin = req.headers.origin;
  if (origin && origin !== originFor(req)) {
    const error = new Error('This request origin is not allowed.');
    error.code = 'INVALID_ORIGIN';
    error.status = 403;
    throw error;
  }
}

function rateLimit(req, key, limit, windowMs = 60_000) {
  const now = Date.now();
  const forwardedFor = process.env.TRUST_PROXY === '1' ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '';
  const bucketKey = `${key}:${forwardedFor || req.socket.remoteAddress || 'unknown'}`;
  const bucket = rateLimits.get(bucketKey);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    rateLimits.set(bucketKey, { startedAt: now, count: 1 });
    return;
  }
  if (bucket.count >= limit) {
    const error = new Error('Too many attempts. Please wait a moment and try again.');
    error.code = 'RATE_LIMITED';
    error.status = 429;
    throw error;
  }
  bucket.count++;
}

function secureCompare(left, right) {
  const a = crypto.createHash('sha256').update(String(left)).digest();
  const b = crypto.createHash('sha256').update(String(right)).digest();
  return crypto.timingSafeEqual(a, b);
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  });
  res.end(data);
}

function sendApiError(res, error) {
  sendJson(res, error instanceof SyntaxError ? 400 : error.status || 500, {
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.code ? error.message : 'The server could not complete the request.',
    },
  });
  if (!error.code) console.error(error);
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 1024 * 1024) {
      const error = new Error('Request is too large.');
      error.code = 'PAYLOAD_TOO_LARGE';
      error.status = 413;
      throw error;
    }
  }
  return JSON.parse(body);
}

function requireMethod(req, method) {
  if (req.method === method) return;
  const error = new Error('Method not allowed.');
  error.code = 'METHOD_NOT_ALLOWED';
  error.status = 405;
  throw error;
}

async function handleApi(req, res, url) {
  try {
    if (url.pathname === '/api/member/session') {
      requireMethod(req, 'GET');
      const profile = database.getMemberSession(cookieValue(req, cookieNames.member));
      if (profile) setCookie(req, res, cookieNames.member, cookieValue(req, cookieNames.member), 30 * 24 * 60 * 60);
      sendJson(res, 200, { data: { authenticated: Boolean(profile), profile } });
      return;
    }
    if (url.pathname === '/api/kiosk/qr-challenge') {
      requireMethod(req, 'POST');
      checkOrigin(req);
      rateLimit(req, 'kiosk-qr-details', 60);
      const { challenge } = await readJson(req);
      sendJson(res, 200, { data: database.getKioskQrDetails({ challenge }) });
      return;
    }
    if (url.pathname === '/api/kiosk/qr-session') {
      if (req.method === 'POST') {
        checkOrigin(req);
        rateLimit(req, 'kiosk-qr-create', 10);
        await readJson(req);
        const session = database.createKioskQrSession({ kioskName: process.env.KIOSK_NAME || 'Isla Kiosk' });
        const qrUrl = new URL('/member/approve-kiosk', originFor(req));
        qrUrl.searchParams.set('token', session.challenge);
        sendJson(res, 201, { data: { id: session.id, pollToken: session.pollToken, kioskName: session.kioskName, expiresAt: session.expiresAt, qrUrl: qrUrl.toString() } });
        return;
      }
    }
    const kioskSessionMatch = /^\/api\/kiosk\/qr-session\/([0-9a-f-]{36})$/.exec(url.pathname);
    if (kioskSessionMatch) {
      const id = kioskSessionMatch[1];
      const pollToken = req.headers['x-kiosk-poll-token'];
      if (req.method === 'GET') {
        rateLimit(req, 'kiosk-qr-status', 90);
        const result = database.getKioskQrStatus({ id, pollToken });
        if (result.status === 'approved' && result.profile) {
          database.revokeKioskSession(cookieValue(req, cookieNames.kiosk));
          const kioskToken = database.createKioskSession(result.profile.studentId);
          setCookie(req, res, cookieNames.kiosk, kioskToken, 12 * 60 * 60);
        }
        sendJson(res, 200, { data: result });
        return;
      }
      if (req.method === 'DELETE') {
        checkOrigin(req);
        database.cancelKioskQrSession({ id, pollToken });
        sendJson(res, 200, { data: { cancelled: true } });
        return;
      }
    }
    if (url.pathname === '/api/member/login') {
      requireMethod(req, 'POST');
      checkOrigin(req);
      rateLimit(req, 'member-login', 5);
      const payload = await readJson(req);
      const profile = dispatch('auth.login', payload);
      database.revokeMemberSession(cookieValue(req, cookieNames.member));
      const token = database.createMemberSession(profile.studentId);
      setCookie(req, res, cookieNames.member, token, 30 * 24 * 60 * 60);
      sendJson(res, 200, { data: profile });
      return;
    }
    if (url.pathname === '/api/member/logout') {
      requireMethod(req, 'POST');
      checkOrigin(req);
      database.revokeMemberSession(cookieValue(req, cookieNames.member));
      clearCookie(req, res, cookieNames.member);
      sendJson(res, 200, { data: { loggedOut: true } });
      return;
    }
    if (url.pathname === '/api/kiosk/logout') {
      requireMethod(req, 'POST');
      checkOrigin(req);
      database.revokeKioskSession(cookieValue(req, cookieNames.kiosk));
      clearCookie(req, res, cookieNames.kiosk);
      sendJson(res, 200, { data: { loggedOut: true } });
      return;
    }
    if (url.pathname === '/api/member/kiosk-approve' || url.pathname === '/api/member/kiosk-cancel') {
      requireMethod(req, 'POST');
      checkOrigin(req);
      rateLimit(req, url.pathname.endsWith('approve') ? 'kiosk-qr-approve' : 'kiosk-qr-cancel', 20);
      const profile = database.getMemberSession(cookieValue(req, cookieNames.member));
      if (!profile) {
        const error = new Error('Sign in to your Isla member account before approving a kiosk login.');
        error.code = 'MEMBER_SIGN_IN_REQUIRED';
        error.status = 401;
        throw error;
      }
      const payload = await readJson(req);
      const result = url.pathname.endsWith('approve')
        ? database.approveKioskQr(payload, profile.studentId)
        : database.cancelKioskQr(payload);
      sendJson(res, 200, { data: result });
      return;
    }
    if (url.pathname === '/api/staff/login') {
      requireMethod(req, 'POST');
      checkOrigin(req);
      rateLimit(req, 'staff-login', 5);
      const { pin } = await readJson(req);
      if (!secureCompare(pin || '', process.env.ISLA_STAFF_PIN || '2468')) {
        const error = new Error('Incorrect staff PIN.');
        error.code = 'INVALID_STAFF_PIN';
        error.status = 401;
        throw error;
      }
      database.revokeStaffSession(cookieValue(req, cookieNames.staff));
      const token = database.createStaffSession();
      setCookie(req, res, cookieNames.staff, token, 15 * 60);
      sendJson(res, 200, { data: { authenticated: true } });
      return;
    }
    if (url.pathname === '/api/staff/logout') {
      requireMethod(req, 'POST');
      checkOrigin(req);
      database.revokeStaffSession(cookieValue(req, cookieNames.staff));
      clearCookie(req, res, cookieNames.staff);
      sendJson(res, 200, { data: { loggedOut: true } });
      return;
    }
    if (url.pathname !== '/api') {
      sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'API route not found.' } });
      return;
    }
    requireMethod(req, 'POST');
    checkOrigin(req);
    const { action, payload = {} } = await readJson(req);
    if (action === 'auth.login') rateLimit(req, 'kiosk-login', 5);
    const kioskProfile = database.getKioskSession(cookieValue(req, cookieNames.kiosk));
    const staffAuthorized = database.isStaffSessionValid(cookieValue(req, cookieNames.staff));
    const data = dispatch(action, payload, {
      kioskStudentId: kioskProfile?.studentId,
      staffAuthorized,
    });
    if (action === 'auth.login') {
      database.revokeKioskSession(cookieValue(req, cookieNames.kiosk));
      const token = database.createKioskSession(data.studentId);
      setCookie(req, res, cookieNames.kiosk, token, 12 * 60 * 60);
    }
    else if (kioskProfile) setCookie(req, res, cookieNames.kiosk, cookieValue(req, cookieNames.kiosk), 12 * 60 * 60);
    sendJson(res, 200, { data });
  } catch (error) {
    sendApiError(res, error);
  }
}

http.createServer((req, res) => {
  let urlPath;
  let url;
  try { url = new URL(req.url, 'http://x'); urlPath = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
  if (urlPath === '/api' || urlPath.startsWith('/api/')) {
    handleApi(req, res, url);
    return;
  }
  if (urlPath === '/member/approve-kiosk') urlPath = '/member/approve-kiosk.html';
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(root, urlPath));
  if (!file.startsWith(root + path.sep) || blocked.test(urlPath) || urlPath.startsWith('/storage/')) { res.writeHead(403).end('Forbidden'); return; }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, {
      'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': st.size,

      'cache-control': urlPath.startsWith('/member/') ? 'no-store' : urlPath.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, host, () => {
  console.log(`Isla Kiosk running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
});
