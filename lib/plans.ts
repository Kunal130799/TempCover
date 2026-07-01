// Flexible temporary-cover pricing for the demo. The reference journey lets the
// customer choose an arbitrary duration (X hours / days / weeks) rather than
// picking one of a few fixed plans, so instead of a hardcoded plan list this is
// a small rate card + a price function. Rates are clearly demo values — a real
// product would price from an underwriting/rating engine.

export type DurationUnit = "hours" | "days" | "weeks";

/** Demo rate card, in pence per single unit. */
export const RATES: Record<DurationUnit, number> = {
  hours: 450, // £4.50 / hour
  days: 1299, // £12.99 / day
  weeks: 6999, // £69.99 / week
};

/** Sensible min/max quantity per unit for the picker. */
export const DURATION_LIMITS: Record<DurationUnit, { min: number; max: number }> = {
  hours: { min: 1, max: 24 },
  days: { min: 1, max: 28 },
  weeks: { min: 1, max: 4 },
};

export function clampDuration(unit: DurationUnit, value: number): number {
  const { min, max } = DURATION_LIMITS[unit];
  const n = Math.round(Number.isFinite(value) ? value : min);
  return Math.min(max, Math.max(min, n));
}

/** Price in pence for the chosen duration (linear against the rate card). */
export function priceFor(unit: DurationUnit, value: number): number {
  return RATES[unit] * clampDuration(unit, value);
}

/** Total cover duration in hours — used to compute the certificate expiry. */
export function durationHoursFor(unit: DurationUnit, value: number): number {
  const v = clampDuration(unit, value);
  if (unit === "hours") return v;
  if (unit === "days") return v * 24;
  return v * 24 * 7; // weeks
}

/** Human label like "1 day", "3 days", "2 weeks", "6 hours". */
export function durationLabel(unit: DurationUnit, value: number): string {
  const v = clampDuration(unit, value);
  const singular = unit.slice(0, -1); // "hour" | "day" | "week"
  return `${v} ${v === 1 ? singular : unit}`;
}

export function isDurationUnit(x: unknown): x is DurationUnit {
  return x === "hours" || x === "days" || x === "weeks";
}

export function formatGBP(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}
