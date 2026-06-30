Build a proof-of-concept Next.js (App Router) application for "TempDrive" — a temporary motor insurance demo. Flow: user enters a vehicle registration number → app fetches vehicle details from an external API → user picks a demo insurance plan → pays via Stripe Checkout → on confirmed payment, a branded PDF insurance certificate is generated and emailed to the user.

## Stack
- Next.js 14+, App Router, TypeScript
- Stripe Node SDK (test mode), Checkout Sessions
- pdfkit for PDF generation
- Resend for sending email (with PDF attachment)
- No database — no persistence beyond generating the PDF to a local /certificates folder before emailing

## Flow / Pages

### 1. `app/page.tsx` — Registration lookup
- Form: single input for vehicle registration number (VRM)
- On submit, POST to `app/api/vehicle-lookup/route.ts`
- Show loading state, then display the vehicle details returned (make, model, colour, fuel type, year, engine capacity, MOT status, tax status)
- "Continue" button moves to plan selection, carrying the VRM + vehicle details forward via query params or client state (no DB, so keep state in the page/client until checkout)

### 2. `app/api/vehicle-lookup/route.ts`
- POST handler, accepts `{ vrm }`
- Calls the vehicle data API: `https://api.checkcardetails.co.uk/vehicledata/vehicleregistration?apikey=${process.env.VEHICLE_API_KEY}&vrm=${vrm}`
- IMPORTANT: the API key must only ever be read from `process.env.VEHICLE_API_KEY` server-side — never expose it to the client or hardcode it
- Return the parsed JSON (make, model, colour, fuelType, yearOfManufacture, engineCapacity, mot, tax) to the frontend
- Handle errors gracefully (invalid reg, API failure) with a clear error message returned to the UI

### 3. Plan selection (can be part of `app/page.tsx` as a second step, or `app/plans/page.tsx`)
- Show 3 hardcoded demo insurance plans, e.g.:
  - "1 Day Cover" — £12.99 — 24 hours
  - "3 Day Cover" — £24.99 — 72 hours
  - "7 Day Cover" — £39.99 — 7 days
- Also collect: policyholder full name, email address (needed for the certificate and for sending it)
- On selecting a plan and submitting, POST to the checkout session route with: vrm, vehicle details, selected plan, policyholder name, email

### 4. `app/api/create-checkout-session/route.ts`
- POST handler
- Creates a Stripe Checkout Session, mode `payment`, using `price_data` for the selected plan's price (no pre-created Stripe Products needed)
- customer_email set to the policyholder's email
- Encode vrm, vehicle details, plan, and policyholder name into Checkout Session `metadata` (Stripe metadata values must be strings — JSON.stringify nested objects, keep total metadata under Stripe's size limits, so just store the essential fields: vrm, make, model, colour, fuelType, policyholderName, planName, planDurationHours, motStatus, motDueDate, taxStatus)
- success_url: `/success?session_id={CHECKOUT_SESSION_ID}`
- cancel_url: `/cancel`
- Return session URL as JSON

### 5. `app/success/page.tsx` (Server Component) — verify, generate, email
- Read `session_id` from search params
- Server-side, retrieve the session via `stripe.checkout.sessions.retrieve(session_id, { expand: ['customer_details'] })`
- If `payment_status === 'paid'`:
  - Pull policyholder/vehicle/plan details back out of `session.metadata`
  - Compute effective date (now) and expiry date (now + plan duration) for the certificate
  - Generate a PDF certificate using pdfkit, closely matching the layout and wording of the attached TempDrive certificate reference: header "TD TempDrive — Temporary motor insurance, done properly.", company details block (TempDrive Insurance Services Ltd, 120 High Holborn, London WC1V 6RD, Co. No. 07423891, FCA ref 412345), "Certificate of Motor Insurance" title, the numbered fields exactly as in the reference (1. Registration Mark of Vehicle, 2. Name of Policy Holder, 3. Effective date, 4. Date of expiry, 5. Persons entitled to drive, 6. Limitations as to use — reuse the same standard limitations text from the reference), a generated policy number (e.g. `TD-{VRM}-{random}`) and certificate number (e.g. `TDV{random}`), a signature line "Marcus Whitfield · Chief Underwriting Officer", and the same Important Notes footer block
  - Save the PDF locally to `/certificates/{certificateNumber}.pdf`, guard against double-generation on page refresh (check if file for this session_id/certificate already exists)
  - Email the PDF as an attachment to the policyholder via Resend, using `process.env.RESEND_API_KEY`, with a short message confirming cover dates and a reminder this is a demo/test policy, not real cover
  - Show a confirmation page: certificate number, policy number, cover dates, and a note that the certificate has been emailed
- If not paid, show a "payment not completed" message

### 6. `app/cancel/page.tsx` — simple cancelled message

## Other requirements
- `.env.local.example` listing `STRIPE_SECRET_KEY`, `VEHICLE_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `/certificates` folder gitignored except `.gitkeep`
- A clear, persistent visual disclaimer in the UI (banner, not buried in small print) on every step stating this is a DEMO and does not provide real insurance cover — important since this mimics a real regulated product (the reference PDF carries genuine FCA/company details that must not be implied as authentic in a demo context)
- README.md covering:
  - Getting a Stripe test secret key
  - Getting/using the vehicle lookup API key (and the warning to never expose it client-side or commit it)
  - Setting up a free Resend account and verifying a sending domain or using their test sending address
  - Running locally: `npm install`, `.env.local`, `npm run dev`
  - Test card `4242 4242 4242 4242`
  - Deployment note: deploys to Vercel by setting the same three env vars in project settings, no webhook config needed since payment verification happens synchronously on the success page (no Stripe webhook in this version)
- "Known limitations / what's missing for production" section: no DB (no record of issued certificates, no way to look up/reissue), no webhook (relies on user reaching /success), real insurance issuance would require actual underwriting/FCA-regulated process — this only mimics the document format, demo plans are hardcoded not pulled from a real rating engine, no validation that emails/PDFs actually deliver beyond Resend's API response

Keep the implementation minimal and readable — this is a proof of concept demonstrating the full lookup → select → pay → certificate flow, not a production insurance platform.