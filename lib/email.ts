import fs from "node:fs";
import { Resend } from "resend";

let _resend: Resend | null = null;

// Lazy client — mirrors lib/stripe.ts so `next build` doesn't require the key
// to be present and the error surfaces clearly on first send instead.
function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error(
      "RESEND_API_KEY is not set. Copy .env.local.example to .env.local and add your key."
    );
  }
  _resend = new Resend(key);
  return _resend;
}

export interface CertificateEmailParams {
  to: string;
  policyholderName: string;
  registrationMark: string;
  planName: string;
  effectiveDate: string; // pre-formatted display strings
  expiryDate: string;
  certificateNumber: string;
  policyNumber: string;
  /** absolute path to the generated PDF */
  pdfPath: string;
}

/**
 * Email the certificate PDF as an attachment. Returns the Resend message id.
 * Throws if RESEND_FROM_EMAIL is missing or the API call fails.
 */
export async function sendCertificateEmail(
  params: CertificateEmailParams
): Promise<string> {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error(
      "RESEND_FROM_EMAIL is not set. Set the verified sending address in .env.local."
    );
  }

  const pdf = fs.readFileSync(params.pdfPath);
  const filename = `${params.certificateNumber}.pdf`;

  const text = [
    `Hello ${params.policyholderName},`,
    "",
    `Your TempDrive temporary cover for ${params.registrationMark} (${params.planName}) is attached as a PDF certificate.`,
    "",
    `Effective: ${params.effectiveDate}`,
    `Expires:   ${params.expiryDate}`,
    `Policy no: ${params.policyNumber}`,
    `Cert no:   ${params.certificateNumber}`,
    "",
    "IMPORTANT: This is a DEMO / TEST policy generated for a proof-of-concept application. It does NOT provide any real insurance cover and has no legal standing. Do not rely on it to drive any vehicle.",
    "",
    "— TempDrive (demo)",
  ].join("\n");

  const { data, error } = await getResend().emails.send({
    from,
    to: params.to,
    subject: `Your TempDrive certificate (DEMO) — ${params.registrationMark}`,
    text,
    attachments: [{ filename, content: pdf }],
  });

  if (error) {
    throw new Error(
      `Resend failed to send the certificate email: ${error.message ?? String(error)}`
    );
  }

  return data?.id ?? "";
}
