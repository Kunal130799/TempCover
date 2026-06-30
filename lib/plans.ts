// Hardcoded demo insurance plans. In a real product these would come from a
// rating engine — here they're fixed and clearly for demonstration only.

export interface Plan {
  id: string;
  name: string;
  /** price in pence (smallest GBP unit) */
  priceInPence: number;
  durationHours: number;
  blurb: string;
}

export const PLANS: Plan[] = [
  {
    id: "1day",
    name: "1 Day Cover",
    priceInPence: 1299,
    durationHours: 24,
    blurb: "24 hours of temporary cover.",
  },
  {
    id: "3day",
    name: "3 Day Cover",
    priceInPence: 2499,
    durationHours: 72,
    blurb: "72 hours of temporary cover.",
  },
  {
    id: "7day",
    name: "7 Day Cover",
    priceInPence: 3999,
    durationHours: 168,
    blurb: "7 days of temporary cover.",
  },
];

export function getPlan(id: string): Plan | undefined {
  return PLANS.find((p) => p.id === id);
}

export function formatGBP(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}
