# Thulir (துளிர்)

A prototype 3D local-commerce platform for Tamil Nadu towns. Customers discover nearby stores in a living
mid-city commercial district, shop department by department across several stores in one basket, check out and follow
their delivery. Store owners, delivery partners and platform admins each have their own portal. Freshness and expiry
validation is enforced **on the server**, not just hidden in the UI.

**Live demo:** https://sahithya74.github.io/Thulir/

> Everything here is **demo software with fictional data**. No store is a real business, no store is "verified",
> no money moves and nothing is delivered.

## Layout

```
client/   Vite + React 19 + TypeScript + Tailwind 4 + React Three Fiber + GSAP + Zustand + React Router
server/   Node + Express 5 + TypeScript + zod (REST under /api/v1)
  src/browser/  the same API running inside a browser tab, for the static GitHub Pages demo
shared/   domain types, freshness engine, order state machine, pricing, IST dates, ₹ formatting, demo data
```

## Run it locally

```bash
# terminal 1 — API
cd server && npm install && cp .env.example .env && npm run dev      # http://localhost:4000

# terminal 2 — web app (proxies /api to the server)
cd client && npm install && npm run dev                              # http://localhost:5180
```

`npm test` and `npm run typecheck` work in both `client/` and `server/`. `npm run build` in `client/` builds the app
that talks to the Node server.

### The GitHub Pages demo

GitHub Pages can only serve files, so `npm run build:pages` (in `client/`, after `npm install` in `server/` too) makes
a static build in which **the real server code runs inside the visitor's browser tab**. A `fetch` bridge sends `/api/v1`
calls to the same route modules, validation, freshness engine, order state machine, role and CSRF checks as the Node
server; small stand-ins replace the few Node-only pieces (Express's router, `node:crypto`, `jsonwebtoken`, `fs`), and
they are unit-tested against Node's behaviour. What that means for a visitor:

- Data lives in the tab's memory: **reloading the page resets everything** (stock, orders, sign-ins). Move between the
  shop and the portals with the in-app links.
- Each tab is its own little server: an order placed in one tab is not visible to an owner signed in in another tab.
- A notice on screen says so. The workflow in `.github/workflows/pages.yml` runs both test suites, builds, and
  publishes `client/dist` to the `gh-pages` branch on every push to `main`.

## Demo accounts (published on purpose)

Every demo account uses the password `Thulir-Demo-2026!`. A real deployment has no seeded accounts. Each sign-in page
lists its demo account — click it to fill in the form.

| Portal | Where | Email |
| --- | --- | --- |
| Store owner | `/owner/login` | `owner.marutham@`, `owner.selvam@`, `owner.pasumai@`, `owner.madhuram@`, `owner.thenral@`, `owner.illam@` — all `…@demo.thulir.test` |
| Delivery partner | `/delivery/login` | `partner@demo.thulir.test` |
| Platform admin | `/admin/login` | `admin@demo.thulir.test` |

Customers check out as guests. The landing page links to all three portals. The server seeds eight demo orders at
start-up through the real order flow, so the portals are not empty.

## What is real

- **Design + entry:** bright ink / teal / coral palette, Fraunces / Inter / Noto Sans Tamil (bundled, no CDN), GSAP entry sequence,
  reduced-motion aware, EN / தமிழ் switcher, ₹ formatting.
- **3D mid-city district:** procedural geometry (no model files), instanced blocks and vehicles, six distinct store
  buildings, GSAP camera fly-ins, drag / wheel / pinch / arrow-key control, focusable store pins. Every shop has its
  own colour, an illuminated name board and a glowing beacon so it can be spotted from afar; the street is alive with
  pedestrians, traffic, drifting clouds and birds. List and schematic map views are always available; low-power
  devices default to the list.
- **Location + delivery:** detect / search / manual address / saved addresses, server-checked pincodes, per-store
  distance, ETA and "delivers to you" computed from the chosen place.
- **Store interiors + catalog:** a walk-in 3D store — enter through sliding doors and move freely (W A S D / arrows,
  drag to look, tap the floor or the minimap to walk, on-screen d-pad on phones) between aisles with department signs,
  double-sided gondolas, wall runs, checkouts and shoppers. Tapping a product (or a search result, or a department tab)
  walks you to it. Packs are drawn to look like the real product — a salt pack shows a window of salt crystals, rice
  shows grains, dal shows lentils. Six themes, plus a list/grid view.
  100 demo products, in-store and cross-store search (English, Tamil and Latin transliteration), filters, sorting,
  substitutions, and eight optional "What are we shopping for today?" missions.
- **Freshness engine (the foundation):** expiry lives on **batches**. Expired, expires-today and unreadable-date stock is
  blocked; near-expiry is configurable per department (platform), per store and per product; stock is drawn
  first-expiry-first-out. The server enforces it at **every gate**: catalog, product, search, missions, basket
  validation, order creation, and again at the moment an order is confirmed.
- **Basket + checkout:** per-store grouping, server-authoritative pricing and offers (the browser sends ids and
  quantities only), never-silent corrections, a calm checkout with phone and slot validation in the browser and again
  on the server.
- **Orders:** one order → several store orders. All-or-nothing stock reservation (no two customers can buy the last
  unit), idempotent retries, 15-minute hold for prepaid orders, freshness re-check at confirmation.
- **Payments:** cash on delivery plus clearly labelled UPI / online **simulations**; a Razorpay slot that refuses to run
  rather than pretend.
- **Store owner portal** (`/owner`): today's view, order handling (accept / reject with a reason / pack / ready / hand
  over), stock and batches, expiry worklists, alerts, rules, activity log, photo upload (checked by content, never SVG).
  Loopholes are closed on the server: expired stock cannot be re-dated or put back on sale, price never exceeds MRP,
  stock never goes negative, changes that remove stock or touch dates need a reason.
- **Delivery partner portal** (`/delivery`): orders are assigned when the store marks them ready (prototype dispatch:
  the first available partner). The partner sees the pickup store, the drop address and instructions, the customer's
  phone, and how much cash to collect. "Picked up" is allowed only after the store hands the bag over, and "Delivered"
  needs the customer's **4-digit handover code**; five wrong codes lock the order.
- **Order tracking:** a stage-by-stage timeline with times, the handover code (shown to the customer only while the order
  is on the road, never to the store or admin), the partner's first name, and an SVG journey labelled
  **"Illustrative simulation — not live GPS"** that moves only when the order's status really changes. The parent order
  becomes "Delivered" when every store order has finished.
- **Platform admin portal** (`/admin`): overview (stores, orders by status, order value per store, freshness compliance),
  stores (suspend / reinstate with a reason — a suspended store disappears for customers and new orders are refused;
  the owner can still sign in), all orders with **masked phone numbers** and support cancellation (stock goes back,
  prepaid amounts recorded as a simulated refund; not possible once the order has left the store), a cross-store
  freshness list, platform freshness rules per department (including expiry-day blocking, which owners cannot change),
  and the activity log across the platform. Admins cannot edit stock.
- **One order state machine** (`shared/src/orderMachine.ts`) names who may take each step; every portal offers only
  those steps and the server re-checks each one.
- **Accounts and access:** bcrypt-hashed passwords; a signed session token in an **httpOnly, SameSite=Lax** cookie
  scoped to `/api`; double-submit **CSRF** check on every write; sign-in rate limiting; roles checked on every request;
  owners reach only their own store, partners only their assigned orders.
- **Notifications:** in-app alerts are real. Email, SMS and WhatsApp exist as stubs that report "not connected";
  nothing claims a message was sent.
- **Database schema:** `server/src/database/schema.sql` — 32 MySQL tables, statically checked by a test (parses as
  MySQL, keys and foreign keys line up, money is never floating point, statuses match the state machine).
- **Tests:** `client/` 176 (geo, delivery, eligibility boundaries incl. IST midnight, catalog, search, missions,
  pricing, basket validation, FEFO, phone and slot rules, order state machine, owner worklists); `server/` 150
  (catalog gatekeeping, orders, idempotency, payments, reservation expiry, last-unit race, rate limits, token forgery,
  role and store isolation, CSRF, inventory rules and loopholes, alerts, audit, photo upload, partner assignment and
  scoping, handover codes and lockout, suspension, admin cancellation, platform rules, analytics, schema checks, and
  the browser stand-ins). Browser suites (Playwright) were run for every phase and for the static build.

## What is simulated

- All stores, ratings, coordinates, pincodes, delivery radii, ETAs, fees, offers, stock and batch dates are fixtures.
  Demo stock is "received" when the server starts, so restarting refreshes expiry dates and stock.
- Brand names and prices are illustrative; no affiliation with any brand is implied. Product images are generated
  illustrations, not photographs.
- Every payment is a demo; refunds are recorded, not paid. Delivery partners, assignment and the journey picture are
  simulations — there is no GPS.

## Not built

- A MySQL repository implementation (the schema is ready) — everything is in memory and resets on restart.
- Customer accounts, password reset, store onboarding / real verification, real dispatch (distance, load, shifts),
  real payment, SMS / WhatsApp / email delivery, maps and geocoding, image resizing / CDN.
- The owner, delivery and admin portals are English only; the customer side has the EN / தமிழ் switch.
- A formal Lighthouse / screen-reader audit. Keyboard access, focus order, labels, reduced motion and phone layouts were
  checked by hand and in the browser suites, but not certified.

## Notes

- **Tamil strings** are limited to short UI labels and still need a native-speaker review before launch.
- If the API is down during local development, the shop falls back to bundled demo data; checkout and portals need it.
- `server` runs through `tsx`; a bundled production build comes with the MySQL work.
- Dev-only console noise: React StrictMode + R3F can log "synchronously unmount a root" warnings in `vite dev`.
