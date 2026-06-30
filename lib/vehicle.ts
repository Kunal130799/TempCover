// Normalised vehicle details shared between the lookup API route and the client.

export interface VehicleDetails {
  vrm: string; // display form, e.g. "NV19 WMK"
  make: string;
  model: string;
  colour: string;
  fuelType: string;
  year: string;
  engineCapacity: string;
  motStatus: string;
  motDueDate: string;
  taxStatus: string;
}

/** Format a raw registration into the conventional "NV19 WMK" display form. */
export function formatVrm(raw: string): string {
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  // Current-style plates are 7 chars (AA99 AAA) -> split after 4.
  if (/^[A-Z]{2}\d{2}[A-Z]{3}$/.test(compact)) {
    return `${compact.slice(0, 4)} ${compact.slice(4)}`;
  }
  return compact;
}

export function compactVrm(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/**
 * The checkcardetails API returns a deeply nested object whose exact shape can
 * vary. Recursively search for the first non-empty value under any of the
 * candidate key names (case-insensitive).
 */
export function findValue(obj: unknown, keys: string[]): string {
  const wanted = keys.map((k) => k.toLowerCase());
  let found = "";

  const visit = (node: unknown) => {
    if (found || node === null || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (found) return;
      if (
        wanted.includes(k.toLowerCase()) &&
        v != null &&
        typeof v !== "object" &&
        String(v).trim() !== ""
      ) {
        found = String(v).trim();
        return;
      }
      if (v && typeof v === "object") visit(v);
    }
  };

  visit(obj);
  return found;
}
