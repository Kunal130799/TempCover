import type Stripe from "stripe";
import {
  generateCertificatePdf,
  makeCertificateNumber,
  makePolicyNumber,
  type CertificateData,
} from "./certificate";

export interface IssuedCertificate {
  certificateNumber: string;
  policyNumber: string;
  data: CertificateData;
  /** The rendered certificate PDF bytes, ready to stream or email. */
  pdf: Buffer;
}

/**
 * Build the certificate for a (paid) Checkout Session and render its PDF.
 *
 * Everything is derived deterministically from the session, so this is fully
 * stateless and safe on an ephemeral / read-only serverless filesystem:
 *  - cover dates come from the session creation time;
 *  - the policy/certificate numbers are seeded from the session id, so they're
 *    identical on every request (success page, refresh, download, email);
 *  - the PDF is rendered in memory each call — no disk writes.
 */
export async function ensureCertificate(
  session: Stripe.Checkout.Session
): Promise<IssuedCertificate> {
  const m = session.metadata ?? {};
  const durationHours = Number(m.planDurationHours ?? "24") || 24;

  const created = new Date((session.created ?? 0) * 1000);
  // Cover starts immediately (at purchase time) unless the customer picked a
  // specific future date (stored as YYYY-MM-DD, cover begins 00:00 that day).
  const coverStart = m.coverStart ?? "immediate";
  const isFutureDate = /^\d{4}-\d{2}-\d{2}$/.test(coverStart);
  const effectiveDate = isFutureDate
    ? new Date(`${coverStart}T00:00:00`)
    : created;
  const expiryDate = new Date(effectiveDate.getTime() + durationHours * 3600_000);
  const issuedDate = created;

  const vrmCompact = m.vrmCompact || (m.vrm ?? "").replace(/\s+/g, "");
  const certificateNumber = makeCertificateNumber(session.id);
  const policyNumber = makePolicyNumber(vrmCompact, session.id);

  const data: CertificateData = {
    certificateNumber,
    policyNumber,
    registrationMark: m.vrm ?? "",
    policyholderName: m.policyholderName ?? "Policyholder",
    make: m.make ?? "",
    model: m.model ?? "",
    colour: m.colour ?? "",
    fuelType: m.fuelType ?? "",
    year: m.year ?? "",
    effectiveDate,
    expiryDate,
    issuedDate,
  };

  const pdf = await generateCertificatePdf(data);

  return { certificateNumber, policyNumber, data, pdf };
}
