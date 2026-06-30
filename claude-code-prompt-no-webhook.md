Build a proof-of-concept Next.js (App Router) application that takes a payment via Stripe Checkout and generates a PDF invoice once payment is confirmed — using only the Stripe secret key, no webhooks.

## Stack
- Next.js 14+, App Router, TypeScript
- Stripe Node SDK (test mode)
- pdfkit for PDF generation
- No database — store nothing persistently beyond the generated PDF file on disk

## Approach (no webhook)
Verify payment synchronously when the customer lands back on the success page, by retrieving the Checkout Session server-side with the secret key and checking its payment_status. This is simpler than a webhook for a demo, with the tradeoff that it only fires if the customer's browser actually reaches /success (acceptable for a controlled demo).

## Pages / Routes

1. `app/page.tsx`
   - Simple form: amount (GBP), customer email, description
   - On submit, POST to the checkout session API route, then redirect the browser to the returned Stripe Checkout URL

2. `app/api/create-checkout-session/route.ts`
   - POST handler
   - Creates a Stripe Checkout Session in `payment` mode using `price_data` (no pre-created Stripe Products needed)
   - Pass through customer email, amount (convert to pence), description
   - success_url: `/success?session_id={CHECKOUT_SESSION_ID}`
   - cancel_url: `/cancel`
   - Return the session URL as JSON

3. `app/success/page.tsx` (Server Component)
   - Read `session_id` from search params
   - Server-side, call `stripe.checkout.sessions.retrieve(session_id, { expand: ['line_items', 'customer_details'] })`
   - If `session.payment_status === 'paid'`:
     - Generate a PDF invoice using pdfkit, saved to a local `/invoices` folder at the project root, filename like `INV-{timestamp}.pdf`
     - Invoice content: invoice number, date, customer email, line items with amounts, total, and placeholder UK business details (company name, address, "VAT No: GB000000000 (placeholder)") clearly marked as placeholders to replace later
     - Display a confirmation message on the page including the invoice number generated
     - Guard against double-generation if the page is refreshed (check if a PDF for this session_id already exists before generating again — use session_id in the filename instead of just timestamp, e.g. `INV-{session_id}.pdf`)
   - If payment_status is not 'paid', show a "payment not completed" message instead

4. `app/cancel/page.tsx` — simple cancelled message

## Other requirements
- `.env.local.example` file listing just `STRIPE_SECRET_KEY`
- `/invoices` folder should be gitignored except for a `.gitkeep`
- README.md covering:
  - Getting a test secret key from dashboard.stripe.com/test/apikeys
  - Running locally: `npm install`, add `.env.local`, `npm run dev`
  - Test card: `4242 4242 4242 4242`, any future expiry, any CVC, any postcode
  - A note that this approach trades robustness for simplicity (no webhook = if the user closes the tab right after paying without reaching /success, no invoice is generated) and that a webhook-based approach is what a production version should use instead
  - Deployment note: once tested locally, this deploys to Vercel with just the `STRIPE_SECRET_KEY` environment variable set in the Vercel project settings — no webhook endpoint configuration needed since there's no webhook in this version
- "Known limitations / what's missing for production" section: no webhook (and therefore no protection against the user never reaching /success), no DB/persistence, no email delivery, placeholder VAT details, test keys only

Keep the implementation minimal and readable — this is a proof of concept to demonstrate the payment-to-invoice flow working end to end, not a production system.
