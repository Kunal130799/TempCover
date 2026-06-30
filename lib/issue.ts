import type Stripe from "stripe";
import {
  certificateExists,
  certificatePath,
  generateCertificatePdf,
  makeCertificateNumber,
  makePolicyNumber,
  readSessionPointer,
  writeSessionPointer,
  type CertificateData,
  type SessionPointer,
} from "./certificate";

export interface IssuedCertificate {
  pointer: SessionPointer;
  data: CertificateData;
  pdfPath: string;
  /** true if this call created the pointer (first time the cert was issued) */
  newlyIssued: boolean;
}

/**
 * Idempotently issue the certificate for a (paid) Checkout Session:
 *  - cover dates are derived deterministically from the session creation time,
 *    so they're identical on every request (success page, refresh, download);
 *  - the policy/certificate numbers are generated once and remembered via a
 *    per-session pointer file;
 *  - the PDF is (re)generated only if it's not already on disk.
 *
 * This makes both the success page and the download route self-sufficient,
 * even on an ephemeral filesystem.
 */
export async function ensureCertificate(
  session: Stripe.Checkout.Session
): Promise<IssuedCertificate> {
  const m = session.metadata ?? {};
  const durationHours = Number(m.planDurationHours ?? "24") || 24;

  const created = new Date((session.created ?? 0) * 1000);
  const effectiveDate = created;
  const expiryDate = new Date(created.getTime() + durationHours * 3600_000);
  const issuedDate = created;

  let pointer = readSessionPointer(session.id);
  let newlyIssued = false;
  if (!pointer) {
    const vrmCompact = m.vrmCompact || (m.vrm ?? "").replace(/\s+/g, "");
    pointer = {
      certificateNumber: makeCertificateNumber(),
      policyNumber: makePolicyNumber(vrmCompact),
      emailed: false,
    };
    writeSessionPointer(session.id, pointer);
    newlyIssued = true;
  }

  const data: CertificateData = {
    certificateNumber: pointer.certificateNumber,
    policyNumber: pointer.policyNumber,
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

  const pdfPath = certificatePath(pointer.certificateNumber);
  if (!certificateExists(pointer.certificateNumber)) {
    await generateCertificatePdf(data);
  }

  return { pointer, data, pdfPath, newlyIssued };
}
