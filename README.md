# Isla Kiosk

Isla Kiosk is a touch-first self-ordering Progressive Web App for Isla Argao. The kiosk UI is a
fixed 1080 × 1920 portrait canvas that scales to fit the display; users cannot change its size or
orientation. The browser app is served with a local Node.js server that stores account, order, and
rewards data in SQLite.

## Features

- Dine-in and take-out ordering, menu search and categories, drink customization, cart, and order
  confirmation.
- Member accounts created with Student ID, full name, email, and a PIN. Name and email use the
  on-screen QWERTY keyboard; the Student ID and PIN use number keypads.
- Guest ordering without an account. Guests can sign in with their phone during an order without
  losing the cart.
- Persistent SQLite accounts, orders, member points, points history, and server-side sessions.
- Members earn 10 points per paid drink. Points are redeemable only for free catalog drinks:
  Caramel Latte (100), Java Chip (100), Matcha Latte (150), Spanish Latte (150), and Ube Dream
  (200). Reward redemption and point updates are recorded with the order in one database
  transaction.
- Card and e-wallet checkout are simulations for testing: no money is charged and no payment
  provider or terminal is connected. Cash orders are marked due at the counter.
- A staff panel for adding reward points to member accounts.

## Run locally

Requirements: Node.js 22.5 or later and a modern browser.

```powershell
npm start
```

Open `http://localhost:8080`. To make the kiosk reachable by a phone or tablet on the same Wi-Fi
network, run:

```powershell
npm run start:lan
```

Open `http://<this-computer-LAN-IP>:8080` on the kiosk and allow Node.js through the local firewall.
The phone and kiosk must be connected to the same Wi-Fi or hotspot. Do not use `localhost` or
`127.0.0.1` in the kiosk URL when a phone needs to reach it. Opening `index.html` directly from
disk is not supported.

The database defaults to `storage/isla-kiosk.sqlite`. Set `ISLA_DB_PATH` to use another file.
Account PINs are salted and hashed. Mobile and kiosk session tokens and temporary QR challenges are
stored as hashes. The service worker caches the app shell; account, ordering, and rewards operations
still need a connection to the Node server.

## Ordering and sign-in flow

1. Choose **Dine In** or **Take out**.
2. At the welcome screen, continue as a guest, sign in or create an account, or choose **Log in
   with QR Code**.
3. Browse the menu, customize drinks, and review the cart.
4. Members can redeem available catalog drinks in the rewards area. Points cannot be exchanged for
   cash discounts.
5. Choose cash, demo card, or demo e-wallet payment and place the order.

### Phone-scanned kiosk QR login

The kiosk displays the QR code; the phone camera scans it. The mobile website does not scan a
member QR, and Firebase is not used.

1. Start the QR login from the welcome screen (or a sign-in prompt during a guest order).
2. Scan the temporary QR code using the phone's regular camera. The link opens the mobile member
   page served by the kiosk.
3. The first time, sign in on the phone with the member's Student ID and PIN, then approve the
   named kiosk. The phone keeps a server-managed, HttpOnly session cookie.
4. On later scans in that phone browser, the active session approves automatically. The kiosk
   polls using a separate secret and signs in with the approved member account.

The challenge expires after two minutes and contains no member details. Mobile sessions expire
after 30 days of inactivity; kiosk sessions expire after 12 hours. **Sign out on this phone**
revokes its mobile session. For local testing, HTTP is acceptable only on a trusted private network;
do not expose the development server to the public internet.

## Rewards and payments

- Paid drinks earn 10 points each; free reward drinks do not earn points.
- Reward prices are checked against the server's catalog and the member's current SQLite balance.
- Reward point deductions, earned points, points history, and order records are committed
  transactionally.
- Card and e-wallet payments display a demo notice and simulate approval only. A successful demo
  payment does not charge an account. Connect and test a real payment provider before enabling
  electronic payments for customers.
- Cash orders remain due at the counter.

## Staff tools

Long-press the Isla logo on the opening screen for three seconds and enter the staff PIN. The local
development PIN defaults to `2468`; set `ISLA_STAFF_PIN` to a private value before deployment. The
staff panel can add points to a member by Student ID. Production requires a staff PIN of at least
eight characters.

## Runtime options

Options can be added to the kiosk URL. The portrait canvas size and orientation are fixed.

| Parameter | Default | Description |
|---|---:|---|
| `keyboard` | `auto` | `always` uses the on-screen keyboard; `never` leaves general text input to the OS; `auto` selects based on the device. Name and email fields in account creation always use the QWERTY modal. |
| `idle` | `90` | Idle seconds before the “Are you still there?” prompt; `0` disables the prompt. |
| `idleCountdown` | `20` | Seconds after the idle prompt before the kiosk clears the session. |
| `confirmReset` | `45` | Seconds before the confirmation screen starts a new order; `0` disables auto-reset. |
| `latency` | `650` | Simulated API delay in milliseconds. |
| `payFail` | `0` | Simulated payment decline rate from `0` to `1`; use `1` to exercise the failure flow. |

Example: `http://localhost:8080/?keyboard=always&idle=120`.

## Production notes

For production, serve the kiosk and mobile page from the same origin over HTTPS. Configure
`NODE_ENV=production`, `PUBLIC_BASE_URL=https://your-kiosk-domain`, a private `ISLA_STAFF_PIN`, and
`TRUST_PROXY=1` only when HTTPS terminates at a trusted reverse proxy. The server requires HTTPS
`PUBLIC_BASE_URL` and a staff PIN of at least eight characters in production. Review the Terms &
Privacy content in the account screen before launch.

## Project layout

```text
server.js                 Node HTTP server and API routes
server/database.js        SQLite schema, authentication, orders, and rewards logic
member/                   Phone sign-in and kiosk-approval page
src/screens/              Opening, account, menu, customization, cart, confirmation, and rewards UI
src/core/                 Session state, routing, formatting, idle handling, and fixed canvas scaling
src/services/api.js       App API, payment simulation, order, and rewards services
src/ui/kioskQrLogin.js    Temporary kiosk QR generation and polling
styles/                   Theme tokens, reusable components, and screen styles
assets/                   Menu imagery and icons
kiosk/                    Platform-specific kiosk launchers
tools/gen-precache.mjs    Service-worker asset list generator
```

After adding or removing app files, refresh the service-worker asset list with:

```powershell
npm run precache
```
