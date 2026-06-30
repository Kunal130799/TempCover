import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Lazily construct the Stripe client. We avoid instantiating at module load so
 * that `next build` (which imports these modules without a key available)
 * doesn't crash — the clear error is surfaced at first request instead.
 */
function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Copy .env.local.example to .env.local and add your test key."
    );
  }

  _stripe = new Stripe(secretKey);
  return _stripe;
}

// Proxy so existing `stripe.checkout...` call sites work unchanged, while the
// real client is only built (and the key only required) on first use.
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripe();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
