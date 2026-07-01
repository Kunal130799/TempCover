# Phase 3 — Redesign TempDrive to match the Tempcover reference journey

Update the existing TempDrive proof-of-concept (Next.js App Router, TypeScript, Stripe Checkout, pdfkit
certificate, Resend email — see `phase2.md`) so its **design and user flow closely match the reference app
shown in the walkthrough video** (Tempcover.com's temporary-insurance quote journey).

Keep the existing backend intact where possible: `app/api/vehicle-lookup/route.ts`, `app/api/create-checkout-session/route.ts`,
`app/api/certificate/route.ts`, the PDF generation in `lib/certificate.ts`/`lib/issue.ts`, the Resend email in
`lib/email.ts`, and the synchronous "verify on /success" pattern (no webhooks). This phase is mostly a
**frontend redesign + a richer quote form + flexible pricing**. The demo disclaimer banner MUST remain on every
step (this mimics a regulated product — see phase2.md).

## Visual language (replace the current blue theme)

Update `app/globals.css` design tokens to the Tempcover palette:
- **Primary / CTA:** orange — `--brand: #f26522` (approx). All primary buttons ("Continue", "Get a quote")
  are solid orange, full-width, bold, rounded ~10px. Remove the blue gradient buttons.
- **Selected-toggle / accent:** dark maroon-purple — `~#4a1a3f`. Used to fill the *selected* state of
  duration toggles (Hours/Days/Weeks) and the numeric quantity tiles.
- Neutrals: white cards, light grey page background, dark near-black ink, muted grey secondary text.
- Logo/wordmark: lowercase bold orange **"tempcover"**-style wordmark (call ours **"tempdrive"** — keep it
  lowercase + orange to match). Replace the current `TD` badge brand block.
- Rounded input fields with a subtle border; clear inline **red** validation text under invalid fields.
- Font: keep the system sans-serif stack; headings large and bold with tight letter-spacing.

## Screen 1 — Marketing homepage + quote start (`app/page.tsx`, "start" step)

Rebuild the top of the page as a hero:
- Header bar: `tempdrive` wordmark (left), a hamburger/menu icon and a person icon (right) — static/decorative
  is fine for the PoC.
- Hero heading **"Quick & Easy Temporary Insurance"**, sub **"Get affordable cover, unbelievably fast"**.
- **Registration input styled as a UK number plate**: blue `GB` prefix box + yellow plate field. Uppercase,
  plate font. Keep the existing `formatVrm`/`compactVrm` helpers from `lib/vehicle.ts`.
  - Add an **"I don't know my reg yet"** link (for the PoC this can just focus the plate field or show a short
    note — no separate manual-vehicle-entry flow required unless you want it).
- **"Can we guess how long you need cover for?"** — three quick-pick buttons: **1 day / 2 days / 1 week**.
- **"Maybe not, choose your own duration"** — a **Hours / Days / Weeks** segmented toggle.
- Orange **Continue** button → advances to the details step, carrying `{ vrm, durationUnit, durationValue }`
  in client state (no DB).
- Below the fold, add lightweight marketing sections to mirror the reference (content can be lorem-ish but
  keep the structure): "Choose short-term cover that's right for you", "Why choose tempdrive" (leading provider
  since 2006, 2.5M drivers), a Trustpilot-style "Our customers love us" testimonial card, "What does temporary
  insurance cover?" (comprehensive cover, accidental/malicious damage, injury, UK + EU third-party),
  "What's optional" (legal expenses up to £100,000, excess reduction), "Forget long quotes — get a price in
  under 2 minutes", an awards strip, an expert quote, and a footer with app-store badges (decorative) +
  Help / Useful-links columns + the RVU/FCA-style regulatory small print. Keep these visually rich but static.

The **reg lookup** still calls `POST /api/vehicle-lookup` — but trigger it when the user clicks Continue on
the start step (not on a separate "Look up vehicle" button), so the vehicle is resolved before the details step.

## Screen 2 — Account gate (`step: "account"`) — OPTIONAL, recommended minimal

Show a **"Sign in or create an account"** interstitial matching the reference:
- Benefits list (faster quotes, access policy documents, view history, app discounts).
- Continue-with **Email / Google / Apple** buttons — **decorative only** (the PoC has no auth).
- A prominent **"Continue as guest"** option that proceeds to the details step.
- Because there is no auth backend, wire the account buttons to also just proceed as guest (or omit this screen
  entirely behind a flag). Do NOT build real OAuth for the PoC.

## Screen 3 — "Enter your details" (`step: "details"`) — the main new form

One long scrollable form (matches the video) with these grouped sections. Use inline validation with red
messages exactly like the reference ("Mobile number is required", "First name must be at least 2 characters",
"Please enter a valid day (1-31)", etc.).

1. **Your contact details**
   - Phone number (new field — add to client state)
   - Email
2. **Vehicle to be covered**
   - Show make + model (e.g. "Kia — OPTIMA 2 CRDI ECODYNAMICS") and the plate, from the lookup result.
   - An **edit pencil** that returns to the start step to change the reg.
3. **Cover details**
   - **"How long do you need cover for?"** — Hours / Days / Weeks toggle (pre-filled from screen 1).
   - A **numeric quantity grid** (tiles 1–7) with a **"+ See more days/weeks"** expander revealing more values
     (e.g. up to 28 days). Selected tile filled in the maroon accent.
   - **"...and when do you want the cover to start?"** — radio: **Immediately** vs **Select day**.
     - "Select day" reveals a **date dropdown** listing the next ~28 days (e.g. "Wed 1st Jul 2026").
     - Keep the reference helper text: *"Policies starting immediately will begin a few minutes after you buy
       your policy. You will see the exact start and end date/time on screen and in your documents after you
       buy."*
4. **About the driver**
   - Info banner: *"To secure a quote, details must exactly match the driver's licence."*
   - **Driver's licence type** dropdown: Full UK / Full Northern Ireland / Full EU / Full International /
     Provisional UK.
   - **Title** dropdown: Mr / Mrs / Miss / Ms.
   - First name, Last name.
   - **Date of birth**: three inputs DD / MM / YYYY.
   - **Postcode** + a **"Find address"** button (for the PoC this can be a no-op or a simple stub — do not
     integrate a real address-lookup API unless asked).
5. **We still need to know**
   - **Reason for cover** dropdown (e.g. Borrowing a vehicle / Buying or selling / Learning to drive /
     Business use / Other).
   - Keep the fraud-check disclaimer text: *"To process your application we will verify your identity and may
     check your details with credit reference and fraud prevention agencies…"*
- Orange **Continue** button at the bottom → goes to the quote/checkout step.

## Flexible pricing (replaces the 3 fixed plans)

The reference lets the user choose an arbitrary duration, so `lib/plans.ts` must become a small **rate card +
price function** instead of 3 hardcoded plans:
- Define per-unit rates, e.g. `HOURLY`, `DAILY`, `WEEKLY` pence rates (clearly marked demo values).
- `priceFor(unit, value): number` returning pence for the chosen duration (e.g. 3 days, 2 weeks).
- Keep `formatGBP`. Compute `durationHours` from `(unit, value)` for the certificate's expiry calculation.
- The start time ("Immediately" = now, or the chosen date) becomes the certificate **effective date**;
  expiry = effective + duration.

Keep the existing `getPlan`-style export only if something still imports it; otherwise remove it and update
callers.

## Screen 4 — Quote + pay (`step: "quote"`)

The video ends before the price/payment screen, so match the *style* of the rest and reuse the current
checkout:
- Show a summary card: vehicle plate + make/model, cover duration, start/end, and the **computed price**.
- Orange **"Continue to secure payment"** button → `POST /api/create-checkout-session`.
- Extend the checkout metadata (Stripe values must be strings) to carry the new fields needed for the
  certificate: `policyholderName` (title + first + last), `email`, `phone`, `durationUnit`, `durationValue`,
  `durationHours`, `coverStart` (ISO or "immediate"), `driverLicenceType`, `reasonForCover`, plus the existing
  vehicle fields. Keep total metadata within Stripe limits (store only essentials; JSON-stringify the vehicle
  block as today).
- `/success` and `lib/certificate.ts`: use the new `coverStart` for the effective date and `durationHours`
  for expiry; put the policyholder's full name and licence/driver details on the certificate where the
  reference layout already has fields. No new PDF layout is required — reuse the existing template, just feed
  it the richer data.

## State & step machine

Replace the current `type Step = "lookup" | "plan"` with:
`"start" | "account" | "details" | "quote"` (account optional/skippable). Carry all collected fields in a
single client-state object. Keep it all client-side until checkout (no DB — consistent with phase2.md).

## Keep / don't break

- Keep the **DEMO banner** on every step (regulated-product mimic — do not present as real cover).
- Keep server-only use of `VEHICLE_API_KEY` in the lookup route; never expose it client-side.
- Keep the no-webhook synchronous verification on `/success`.
- Keep `.env.local.example`, the gitignored `/certificates` folder, and the Resend email step unchanged.
- Update `README.md` to describe the new multi-step journey and the flexible pricing rate card.

## Explicitly out of scope for this PoC (do NOT build unless asked)

- Real Google/Apple/email authentication or accounts.
- A real postcode → address lookup integration ("Find address" is a stub).
- A real rating engine (rates stay hardcoded demo values).
- Persisting quotes/policies to a database.

Keep the implementation minimal and readable — this is still a proof of concept. The goal of Phase 3 is to make
the **look and the quote journey** match the reference video, reusing the existing lookup → pay → certificate →
email plumbing underneath.
