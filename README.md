# TempDrive — temporary insurance POC (no webhook)

> ⚠️ **DEMO ONLY.** This is a proof-of-concept. It does **not** provide real
> insurance cover and any certificate it issues has **no legal standing**. The
> certificate reproduces the format of a regulated document (FCA / company
> details, "Authorised Insurers" wording) purely to demonstrate the flow — none
> of it is authentic. A prominent disclaimer banner is shown on every page.

A minimal Next.js (App Router, TypeScript) app demonstrating the full
**quote → enter details → pay → emailed PDF certificate** flow, with a UI and
journey modelled on a real temporary-insurance provider (see
`phase3-tempcover-redesign.md`):

1. **Start** — marketing hero with a UK number-plate reg input, quick-pick
   durations (1 day / 2 days / 1 week) and a Hours / Days / Weeks picker.
   Continuing fetches vehicle details from an external vehicle data API.
2. **Account** — a "sign in or create an account" gate. Auth is not part of the
   demo, so every option (including **Continue as guest**) proceeds the same way.
3. **Details** — one long form: contact (phone + email), the vehicle to be
   covered, cover details (duration + start date), driver details (licence type,
   title, name, DOB, postcode) and reason for cover, with inline validation.
4. **Quote** — a summary card with the price computed from the duration, then
   pay via **Stripe Checkout** (test mode).
5. On confirmed payment, a branded **PDF certificate** is generated with
   `pdfkit` and **emailed** to the policyholder via **Resend**.

Pricing is a small **rate card** (`lib/plans.ts`): a per-hour / per-day /
per-week pence rate × the chosen quantity, so any duration produces a price
(replacing the earlier three fixed plans). The chosen start ("Immediately" or a
future date) becomes the certificate's effective date; expiry = effective +
duration.

Payment is verified _synchronously_ on the success page — **no webhooks**. When
the customer returns to `/success`, the server retrieves the Checkout Session
with the secret key and checks `payment_status`. If `paid`, the certificate is
generated to `certificates/` and emailed.

## How it works

```
/ (start: reg + duration) ─POST─▶ /api/vehicle-lookup ─▶ checkcardetails.co.uk
        │                                                  (VEHICLE_API_KEY, server-side)
   account gate → enter details (contact, cover, driver) → quote
        │
        └─POST─▶ /api/create-checkout-session ─▶ Stripe Checkout (hosted)
                                                      │  pay with test card
                                                      ▼
   certificates/TDV######.pdf  ◀─generate+email─  /success?session_id=...
        (emailed via Resend)                       (retrieves session,
                                                     checks payment_status)
```

## Prerequisites & keys

### 1. Stripe test secret key

- Go to <https://dashboard.stripe.com/test/apikeys> (ensure **Test mode** — top
  right toggle).
- Copy the **Secret key** (`sk_test_...`) → `STRIPE_SECRET_KEY`.

### 2. Vehicle lookup API key

- Sign up at <https://checkcardetails.co.uk> and obtain an API key for the
  `vehicledata/vehicleregistration` endpoint → `VEHICLE_API_KEY`.
- **Security:** this key is read **only server-side** in
  `app/api/vehicle-lookup/route.ts` (`process.env.VEHICLE_API_KEY`). Never put it
  in a `NEXT_PUBLIC_*` var, never hardcode it, and never commit `.env.local`.

### 3. Resend (email)

- Create a free account at <https://resend.com> and an API key at
  <https://resend.com/api-keys> → `RESEND_API_KEY`.
- For quick testing you can send from Resend's shared onboarding address
  `onboarding@resend.dev` (deliverable to your own account email). To send to
  arbitrary recipients, **verify a sending domain** in the Resend dashboard and
  use an address on it.
- Set the sender as `RESEND_FROM_EMAIL`, e.g. `TempDrive Demo <onboarding@resend.dev>`.

## Running locally

```bash
npm install
cp .env.local.example .env.local   # then fill in the four values below
npm run dev
```

`.env.local` keys:

```
STRIPE_SECRET_KEY=sk_test_...
VEHICLE_API_KEY=...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=TempDrive Demo <onboarding@resend.dev>
```

Open <http://localhost:3000>, enter a registration and duration, work through the
details form, and pay.

### Test card

| Field    | Value                 |
| -------- | --------------------- |
| Number   | `4242 4242 4242 4242` |
| Expiry   | any future date       |
| CVC      | any 3 digits          |
| Postcode | any value             |

After a successful payment you're redirected to `/success`: the certificate is
generated to `certificates/TDV######.pdf`, emailed to the policyholder, and the
certificate / policy numbers and cover dates are shown on screen. There's also a
**Download certificate (PDF)** button that streams the file from
`GET /api/certificate?session_id=...` (which re-verifies the session is paid and
regenerates the PDF if it's missing). Refreshing the page won't regenerate or
resend (a per-session pointer guards against that).

## Deployment (Vercel)

Deploys to [Vercel](https://vercel.com) by setting the **same three** secrets in
**Project Settings → Environment Variables**:

- `STRIPE_SECRET_KEY`
- `VEHICLE_API_KEY`
- `RESEND_API_KEY` (and `RESEND_FROM_EMAIL`)

**No webhook configuration is needed** — payment verification happens
synchronously on the success page.

> ⚠️ **Filesystem note:** Vercel's serverless filesystem is ephemeral (only
> `/tmp` is writable, and not persistent). PDFs written to `certificates/` won't
> persist between requests in production — the email attachment is generated and
> sent within the same request, so delivery still works, but the local copy and
> the refresh-dedup pointer won't survive. A real deployment would write to
> object storage (S3 / R2) and record issuance in a database.

## Known limitations / what's missing for production

- **No database / persistence** — there's no record of issued certificates, no
  way to look one up or reissue it. The only artifact is the PDF on disk (and
  the email).
- **No webhook** — generation/emailing only happens if the customer's browser
  reaches `/success`. If they close the tab right after paying, the payment
  succeeds but no certificate is issued. Production should use a
  [Stripe webhook](https://stripe.com/docs/webhooks) on
  `checkout.session.completed`.
- **Not real insurance** — issuing real cover requires an actual,
  FCA-regulated underwriting process. This only mimics the *document format*.
- **Hardcoded demo rate card** — pricing is a fixed per-unit rate card in
  `lib/plans.ts`, not produced by a real rating engine.
- **No real accounts / auth** — the "sign in or create an account" screen is
  decorative; every option continues as a guest.
- **Stubbed address lookup** — the driver "Find address" button is a stub; enter
  the postcode manually. Driver details are collected but not otherwise verified.
- **No delivery guarantees** — "emailed" means Resend accepted the request; the
  app doesn't verify the email or PDF actually arrived.
- **Test keys only** — built for Stripe test mode.
- **Ephemeral storage in production** — see the Vercel note above.

## Project structure

```
app/
  page.tsx                              # multi-step journey: start → account → details → quote (client)
  layout.tsx                            # shell + persistent DEMO banner
  globals.css                           # design system (Tempcover-style orange theme)
  api/vehicle-lookup/route.ts           # server-side vehicle data lookup
  api/create-checkout-session/route.ts  # creates the Stripe Checkout Session
  api/certificate/route.ts              # streams the cert PDF for download
  success/page.tsx                      # verify payment, generate + email cert
  cancel/page.tsx                       # cancelled message
lib/
  stripe.ts          # lazy Stripe client
  plans.ts           # demo pricing rate card + duration helpers
  vehicle.ts         # vehicle types + VRM helpers + response parser
  certificate.ts     # PDF certificate generation (pdfkit) + session dedup
  issue.ts           # idempotent cert issuance shared by /success and download
  email.ts           # Resend email with PDF attachment
certificates/                           # generated PDFs (gitignored)
```
