#!/usr/bin/env node
// Zero-dependency static server for running the kiosk locally or on a kiosk PC.
//   node server.js            → http://localhost:8080
//   PORT=3000 node server.js
//   HOST=0.0.0.0 node server.js   (serve tablets on the same LAN)
// Any static host (nginx, IIS, Netlify, S3, GitHub Pages…) works just as well.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || '127.0.0.1';
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const blocked = /^\/(kiosk|tools|node_modules|\.git)(\/|$)/;

http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(root, urlPath));
  if (!file.startsWith(root + path.sep) || blocked.test(urlPath)) { res.writeHead(403).end('Forbidden'); return; }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, {
      'content-type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'content-length': st.size,
      // the service worker handles offline caching; always revalidate app files
      'cache-control': urlPath.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(port, host, () => {
  console.log(`Isla Kiosk running at http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
});
