# Isla Kiosk

A self-order kiosk for **Isla Argao** café, built from the Figma file *Isla Kiosk – FINAL*.
It's a touch-first **Progressive Web App** with no runtime dependencies. It runs full-screen in
kiosk mode on **Windows, macOS, Android and iPadOS** (and Linux/Raspberry Pi), in portrait or landscape.

Version 2 adds a McDonald's-kiosk-style experience:
- **Kiosk-size canvas on any screen.** The app always lays out at 1080×1920 and scales to fit, so a laptop shows exactly what the kiosk shows.
- **QR member sign-in.** Scan the QR from the Isla app with the camera or a USB QR scanner, or type the 6-digit member code.
- **Points system.** Use points as a discount (typed on a keypad or picked from quick amounts), redeem free drinks into the order, collect points by scanning mid-order, and let staff add points.

> **Backend status:** every backend feature (accounts, orders, payments, rewards) is a **local mock**.
> Nothing is sent to a server, no payment is really taken, and the code has no API keys.
> See [Connecting real services](#connecting-real-services).

---

## Why a PWA (platform choice)

- **One codebase for every target.** Edge and Chrome kiosk modes (Windows, macOS, Linux), Android
  Chrome or a kiosk browser, and iPadOS Safari added to the Home Screen all run the same build.
  There are no app-store releases, and updating means redeploying static files.
- **Zero dependencies, no build step.** It's plain ES modules, CSS and HTML. Nothing has to be
  installed, patched or audited on the kiosks, and the files can be served by any static host.
- **Offline-tolerant.** A service worker precaches the app, so the UI keeps working on flaky café
  Wi-Fi. Real orders still need the network once the backend is connected.
- **Native wrapper later if needed.** The same folder can be wrapped with Capacitor (Android/iPad
  app-store builds, native card-reader SDKs) or Electron (locked-down desktop shell) without UI changes.

---

## Testing on a laptop (kiosk size)

Run `npm start` and open `http://localhost:8080`. The app renders on a fixed **1080×1920 kiosk
canvas** scaled to fit your window, with the letterbox around it. A small pill at the top switches the preview:

| Preview | What you see |
|---|---|
| **Kiosk portrait** (default) | 1080×1920, the standard kiosk screen |
| **Kiosk landscape** | 1920×1080, for wide kiosks or wall-mounted TVs |
| **Fit screen** | Fully responsive, for tablets and phones |

Your choice is remembered on that browser. You can also set it with `?view=portrait|landscape|fill`.
The kiosk launch scripts add `?view=portrait&preview=0`, which hides the pill.

**Try QR sign-in on a laptop:**
- **Webcam:** open `docs/demo-member-qr.png` on your phone and hold it up to the webcam on the "Scan your Isla QR" screen.
- **USB QR scanner:** plug one in (keyboard-wedge mode, the default for most scanners) and scan the same image.
- **No camera:** tap **Enter member code** and type `482917`, or tap **Simulate a scan**.

---

## Screens & user flow (from the Figma file)

```
Splash (Dine In | Take out)
  └─ Welcome ─┬─ Scan QR (camera / USB scanner / member code) ─► "Log in Successfully!" ─► Menu (member)
              ├─ Log In ──(keypad)──► "Log in Successfully!" ─► Menu (member)
              │    ├─ Forgot PIN? (info)        └─ Create Account ─► Sign Up ─► "Account Created!" ─► Log In
              │    └─ Continue as Guest
              └─ Continue as Guest ─► "Continue as Guest" modal ─► Menu (guest)

Menu: category rail (Rewards + 7 categories) · search · product cards · points pill · rewards banner
      · sticky "YOUR ORDER" bar · user chip (Exit / Log out / My Rewards & QR / Scan QR to earn points)
  └─ Rewards rail ─► add a free drink with points ─► "Reward Redeem!"
  └─ Guest taps "Scan QR" anytime ─► signed in, cart kept, points earned on this order
  └─ tap drink ─► Customize Your Add-ons ─► "Added to Order!" ─► Menu
  └─ Checkout ─► Your Order (qty ±, remove, Isla Rewards panel: ₱20 coupon · use points [50/100/200/Max/Enter points]
                   · free reward drinks · "+N pts" preview; guests: Scan QR to earn) · Cards / E-Wallet / Cash · totals
                   ├─ Cancel Order (confirm) / Continue Shopping
                   └─ Place Order ─► [card/e-wallet payment sheet] ─► Order Confirmed! (IS-427…, points earned/used/new balance,
                                                                       auto-restarts after 45 s)
                                         ├─ Back to Menu
                                         └─ View Rewards ─► Rewards (member QR + code, points, progress, rewards, history)
```

| Figma frame | Implemented in |
|---|---|
| SPLASH SCREEN, WELCOME SCREEN, CONTINUE AS GUEST, guest-modal | `src/screens/entry.js` |
| LOG IN, SIGN UP, input number modal, acc created / log in modals | `src/screens/auth.js`, `src/ui/keypad.js` |
| DASHBOARD, DASHBOARD (GUEST), 6 category frames + "g" variants, DASHBOARD 1 | `src/screens/menu.js` (one data-driven screen) |
| add ons modal (×3), Added success modal (×2) | `src/screens/addons.js` |
| ORDERS(CART) | `src/screens/cart.js` |
| Order confirmation | `src/screens/confirmation.js` |
| user reward, reward modal | `src/screens/rewards.js` |
| exit, logout popovers | `src/core/session.js` (`openUserMenu`) |

Additional states not drawn in Figma but needed for a working kiosk: field validation and
login errors, menu loading/error/no-results states, an empty cart, a payment-in-progress sheet with
cancel, payment-declined and order-failed dialogs with retry, insufficient points for a reward,
an idle "Are you still there?" countdown, an on-screen keyboard and a hidden staff panel.

---

## Run it

Requirements: any modern browser. To use the bundled server you also need **Node.js 18+**, or
you can use any static web server.

```bash
cd isla-kiosk
npm start                 # → http://localhost:8080   (same as: node server.js)
npm run start:lan         # serve to tablets on the same network: http://<this-PC-IP>:8080
# no Node? any static server works, e.g.:  python3 -m http.server 8080
```

Open `http://localhost:8080`. Opening `index.html` directly from disk doesn't work, because ES
modules and the service worker need http(s).

**Demo account:** Student ID `7230509`, PIN `1234` (Ashly Nicle Mamites, 250 points, one ₱20 coupon).
New accounts you sign up are stored in the browser's local storage.

### Configuration (URL parameters)
Set these per device in the kiosk launcher URL, for example `https://kiosk.example.com/?idle=120&keyboard=always&demo=0`.

| Param | Default | Meaning |
|---|---|---|
| `keyboard` | `auto` | `always` uses the built-in on-screen keyboard (recommended for Windows/macOS kiosks). `never` uses the OS keyboard. `auto` uses the built-in one on touch PCs and the native one on iPad/Android. |
| `idle` | `90` | Seconds without a touch before "Are you still there?" appears (`0` turns it off). |
| `idleCountdown` | `20` | Seconds before the session is wiped and the kiosk returns to the splash screen. |
| `view` | remembered, else `portrait` | `portrait` (1080×1920 canvas), `landscape` (1920×1080 canvas) or `fill` (responsive). |
| `preview` | `1` | Shows the preview-size pill. The kiosk launchers set `preview=0`. |
| `camera` | `user` | Which camera scans QR codes: `user` (front-facing, typical kiosk) or `environment`. |
| `confirmReset` | `45` | Seconds the order-confirmation screen waits before starting a new order (`0` = off). |
| `demo` | `1` | Shows the demo credentials, demo member code and "Simulate a scan" link. **Set `demo=0` in production.** |
| `fullscreen` | `1` | Requests fullscreen on the first tap when the kiosk isn't already in kiosk or standalone mode. |
| `adminPin` | `2468` | Staff panel PIN (**mock**; set your own). |
| `latency`, `payFail` | `650`, `0` | Mock backend delay (ms) and payment-decline rate (0–1). Use `payFail=1` to test the error flow. |

**Staff panel:** long-press the Isla logo on the splash screen for 3 seconds and enter the staff PIN.
From there staff can **add reward points to a member** (by Student ID), reset the demo data,
reload the app, or toggle fullscreen.

---

## QR sign-in (McDonald's-kiosk style)

Members open the Isla app, show **My QR**, and scan it at the kiosk. Three inputs are supported at once:

1. **USB / built-in QR scanner** in keyboard-wedge mode, the usual kiosk hardware. The scanner "types" the
   code and presses Enter. The kiosk tells it apart from a person typing by the speed of the keystrokes.
2. **Camera.** The browser's `BarcodeDetector` is used where available (Chrome/Edge on macOS, Android
   and ChromeOS). Elsewhere (Windows, iPadOS) the **jsQR** decoder is loaded, from `src/vendor/jsQR.js` if
   present or otherwise from the jsDelivr CDN. **For offline kiosks, download
   [jsQR 1.4.0](https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js) into `src/vendor/jsQR.js`.**
   Camera access needs HTTPS or `localhost`.
3. **Member code.** The 6 digits printed under the QR, typed on the keypad.

A guest can scan at any point (the points pill, the banner, the account menu, or the cart). They are
signed in **without losing their order** and earn points on it. Member QR codes are generated on the
device by a vendored, MIT-licensed encoder (`src/vendor/qrcode.js`), so the Rewards screen can show each
member's QR offline.

**Mock QR format:** `ISLA1:<studentId>:<memberCode>`. ▶ For production, the Isla app should show a
**short-lived signed token** (for example an HMAC or JWT over the student ID plus an expiry) that your
backend verifies, so a screenshot of someone's QR stops working after a minute.

## Rewards points system

| Rule | Value (in `src/config.js`) |
|---|---|
| Earn | 10 pts per paid drink (`pointsPerDrink`). Free reward drinks don't earn points. |
| Use as a discount | 1 pt = ₱0.50, so 2 pts = ₱1 (`pesoPerPoint`). Used in steps of 10 (`pointsStep`), up to your available balance and the amount due after the voucher. |
| Free drinks | Caramel Latte or Java Chip 100 pts · Matcha Latte or Spanish Latte 150 pts · Ube Dream 200 pts (`REWARD_CATALOG` in `api.js`) |
| Vouchers | The ₱20 off coupon from the design, one-time, members only |

At checkout, members see their balance, the voucher toggle, and **Use points** with quick amounts
(50 / 100 / 200 / Max) or **Enter points** on the keypad. Reward drinks and points are only deducted
when the order is placed, together with the order, and the new balance is shown on the confirmation.
If rewards cover the whole order, payment is skipped. Staff can add points from the staff panel.

---

## Kiosk-mode setup per platform

Put the app on a web server first (any HTTPS static host, or `node server.js` on the kiosk itself),
then lock the device to it. The scripts in `kiosk/` start the local server automatically when the
URL is `localhost`.

### Windows 10/11
- **Quick:** run `kiosk\windows\start-kiosk.bat` or `start-kiosk.ps1 -Url https://…`. It launches
  **Edge** with `--kiosk --edge-kiosk-type=fullscreen` (Chrome is commented in as an alternative).
  To start it at boot, put a shortcut in `shell:startup` on an auto-login account.
- **Locked down (recommended):** *Settings → Accounts → Other users → Set up a kiosk* (Assigned
  Access) → choose **Microsoft Edge** → "As a digital sign or interactive display" → enter the URL.
  Intune/MDM can push the same config.
- Turn on the Touch Keyboard service, or use `?keyboard=always` (the default in the scripts).
  Turn off edge swipes with the Group Policy *Allow edge swipe = Disabled*.
- Note: Edge's `--kiosk-idle-timeout-minutes` clears browser data, which also resets the **mock**
  accounts kept in local storage. Real data lives on your backend, so this doesn't matter in production.

### macOS
- Run `kiosk/macos/start-kiosk.command`. It opens **Chrome** with `--kiosk` and keeps the display awake.
- For a dedicated kiosk: create a standard user with auto-login (*Users & Groups*), add the script
  to *Login Items*, turn off sleep and screen saver, and hide the Dock. For managed fleets, an MDM
  profile can restrict the user to Chrome.

### Android tablets
1. Open the URL in **Chrome** → menu → **Install app** (or *Add to Home screen*). The manifest
   launches it full-screen with no browser UI.
2. Lock it:
   - **Screen pinning:** *Settings → Security → App pinning*, open the app, then pin it from Overview.
   - **Managed:** use Android Enterprise *dedicated device / lock-task mode* through your MDM
     (Intune, Workspace ONE, Google Android Management API), allow-listing the installed PWA or Chrome.
   - **Alternative:** a kiosk browser such as Fully Kiosk Browser pointed at the URL.

### iPadOS
1. Open the URL in **Safari** → Share → **Add to Home Screen**. It launches standalone
   (no Safari UI) and the service worker gives offline support.
2. Lock it:
   - **Guided Access:** *Settings → Accessibility → Guided Access → On* (set a passcode). Open the
     app and triple-click the top/Home button to start. Turn off *Auto-Lock* under Display & Brightness.
   - **Managed:** supervise the iPad (Apple Configurator / Apple Business Manager) and apply
     **Single App Mode** via MDM to the Home Screen web app or Safari.

### Linux / Raspberry Pi (bonus)
`kiosk/linux/start-kiosk.sh` runs Chromium with `--kiosk` and turns off screen blanking.

---

## Responsive & touch design
- The UI is measured against the 1080×1920 artboard: `1rem` = 10 design px. The root font size
  scales with the viewport, so proportions match Figma at any portrait size. Landscape uses a
  1920×1080 reference with dedicated layouts: two-column auth screens, a menu with an order
  sidebar, cart items beside payment, and a side-by-side receipt.
- Touch targets are at least about 48 CSS px. Several design elements were enlarged for real
  fingers: category chips (42→60 px), "Add+" pills (35→50 px), steppers and the back button.
- Kiosk hardening: no pinch or double-tap zoom, no text selection, no context or long-press menus,
  no pull-to-refresh, and focus-visible outlines for accessibility. It respects `prefers-reduced-motion`.
- Privacy: the session lives in memory only and is wiped on Exit/Log out or idle timeout. PINs are
  masked, and the Student ID is masked on the rewards screen.

---

## Project structure
```
index.html, manifest.webmanifest, sw.js    App shell, PWA manifest, offline service worker
server.js                                  Zero-dependency static server (Node 18+)
styles/   tokens.css (design tokens) · base.css (scale, transitions, kiosk hardening) · components.css · screens.css
src/
  main.js            Boot: registers screens, idle watchdog, service worker
  config.js          Per-device settings (URL params)
  core/              dom helpers · router (history + transitions) · store (session/cart/points/totals) · viewport (kiosk canvas) · idle · session · format
  data/menu.js       MOCK catalog: 25 drinks, 6 categories, 4 add-ons (from the design)
  services/api.js    ★ All backend calls (mocked) — the only file to change when going live
  services/scanner.js  QR input: USB keyboard-wedge scanners + camera (BarcodeDetector / jsQR)
  services/storage.js  Safe localStorage wrapper with in-memory fallback
  vendor/qrcode.js   QR encoder (MIT, Kazuhiko Arase) for member QR codes
  ui/                icons · overlay (modals/dialogs/toasts) · keypad · on-screen keyboard · QR sign-in sheet · member QR card · components · staff panel
  screens/           entry · auth · menu · addons · cart · confirmation · rewards
assets/img/          Images exported from the Figma file (optimized to WebP/JPEG; ~0.7 MB total)
assets/icons/        SVG icons exported from Figma vectors (also inlined in src/ui/icons.js)
docs/demo-member-qr.png  Demo member QR to scan from your phone while testing
kiosk/               Windows / macOS / Linux launch scripts
tools/gen-precache.mjs   Refreshes the service-worker file list — run `npm run precache` after changing files
```

---

## Connecting real services
Every integration point is marked `▶ INTEGRATION POINT` in `src/services/api.js` (plus one in
`sw.js` and one in `store.js`). Keep each function's inputs and outputs the same and throw
`ApiError(code, message)` on failure. The screens already handle loading, errors and retries.

| Function | Replace with |
|---|---|
| `authService.login / signup` | Your student-ID / SSO service. Verify PINs **server-side** (hashed), and return a session token plus a profile. |
| `authService.loginWithQr / loginWithMemberCode` | Verify the app's signed, short-lived QR token, or the member code, on your backend. |
| `authService.requestPinReset` | Currently "reset at the counter" (shown in the Forgot PIN dialog). |
| `menuService.getCatalog` | POS or CMS menu with availability. Sold-out items already render disabled. |
| `paymentService.charge` | **Cards:** the card-terminal SDK (e.g. Stripe Terminal, Adyen, or a local bank terminal). **E-Wallet:** GCash/Maya merchant APIs (dynamic QR plus webhook). The QR shown now is a clearly labelled placeholder. **Cash:** no charge; the order is flagged "pay at counter". |
| `orderService.place` | POS / kitchen-display order API that returns the queue number (mock: `IS-427`, `IS-428`, …). |
| `rewardsService.getSummary`, `REWARD_CATALOG` | Your loyalty service: balance, vouchers, reward catalog and history. |
| `orderService.place` (loyalty part) | Deduct reward drinks and used points, and credit earned points, in the same transaction as the order. |
| `staffService.addPoints` | A staff-authenticated loyalty adjustment endpoint. |

Keep secrets on your backend, behind your own API. The kiosk browser should only ever hold a
short-lived session token.

---

## Assumptions (where the design was unclear)
1. **Merry Matcha costs ₱75.** The menu card says "Php 59", but the add-ons modal, cart and
   receipt use ₱75 (₱75 + ₱11 espresso = ₱86). The cart math was kept.
2. **Category membership** follows the category frames. Vanilla Latte appears on the Matcha frame,
   which looks like a placeholder, so it is listed under Espresso Based only. Matcha Espresso and
   Merry Matcha are Matcha Series.
3. **The frame named "log in failed- modal" shows a success message.** It's used as the
   "Log in Successfully!" dialog. Login failure is shown inline under the form.
4. **Keypad:** the design's keypad modal has no display or confirm button. A value display,
   **Done** and **Cancel** were added. The bottom-left key is "–" for Student IDs and "Clear" for PINs.
5. **Points:** "10 points per drink" (from the rewards screen) matches "You earned 20 points" for
   two drinks on the receipt. Guests earn nothing.
6. **₱20 coupon:** a members-only, one-time coupon from the loyalty account, applied with a
   toggle. Guests see a "Scan QR to earn points" prompt instead.
12. **Version 2 design changes (requested "McDo kiosk" style):** a category rail with photos replaces
    the chip row, product cards are larger with a "+" button, a sticky order bar replaces the
    "YOUR ORDER" panel, the welcome screen leads with **Scan QR**, "Added to Order!" closes itself
    after about 2 seconds, and the confirmation screen restarts after 45 seconds. Colors, type and
    imagery still come from the Figma file.
13. **Points value and reward costs** (1 pt = ₱0.50, free drinks from 100 pts) are assumptions chosen to
    fit the design's "10 points per drink" and "Free Caramel Latte 100 pts". Adjust them in `config.js` and `api.js`.
7. **Add-ons:** ₱11 each, up to 3 of each. Juices have no add-ons. The modal also has a drink
   quantity stepper.
8. **Extras that weren't drawn:** tapping the "Dine In" pill switches to Take out. The member
   account menu adds **My Rewards** next to *Log out*. Guests get **Finish** instead of
   *View Rewards* on the confirmation.
9. **Typography:** Playfair and Montserrat load from Google Fonts. The confirmation card's one-off
   Fredoka/Nunito/Roboto text was normalized to Montserrat for consistency.
10. **Terms & Privacy** content is a **placeholder** and must be replaced before launch.
11. "Remember my Student ID" stores only the ID (never the PIN) on that device. Turn it off on
    shared kiosks if your privacy policy requires.

### Offline fonts
For kiosks that may boot without internet, download the Playfair and Montserrat WOFF2 files
(Google Fonts, OFL licence) into `assets/fonts/`. Then replace the Google Fonts `<link>` in
`index.html` with local `@font-face` rules and run `npm run precache`. Until then, if the fonts
can't load the first time, the app falls back to Georgia and system sans-serif. After one online
load, the service worker caches the fonts.
