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
  /** the rendered certificate PDF bytes */
  pdf: Buffer;
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
    "Please keep this certificate safe. Refer to the policy wording and schedule for full details of your cover.",
    "",
    "— TempDrive",
  ].join("\n");

  const { data, error } = await getResend().emails.send({
    from,
    to: params.to,
    subject: `Your TempDrive certificate — ${params.registrationMark}`,
    text,
    attachments: [{ filename, content: params.pdf }],
  });

  if (error) {
    throw new Error(
      `Resend failed to send the certificate email: ${error.message ?? String(error)}`
    );
  }

  return data?.id ?? "";
}
