import Link from "next/link";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { formatDateTime } from "@/lib/certificate";
import { ensureCertificate } from "@/lib/issue";
import { sendCertificateEmail } from "@/lib/email";

// Always render fresh — payment status is verified on each request.
export const dynamic = "force-dynamic";
// pdfkit needs the Node runtime (filesystem-backed font data); not the Edge one.
export const runtime = "nodejs";

interface SuccessPageProps {
  searchParams: { session_id?: string };
}

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const sessionId = searchParams.session_id;

  if (!sessionId) {
    return (
      <Panel title="Missing session">
        No checkout session id was provided.
      </Panel>
    );
  }

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>>;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer_details", "payment_intent"],
    });
  } catch (err) {
    console.error("Failed to retrieve checkout session:", err);
    return (
      <Panel title="Could not verify payment">
        We couldn&apos;t look up that checkout session. Please check the link and
        try again.
      </Panel>
    );
  }

  if (session.payment_status !== "paid") {
    return (
      <Panel title="Payment not completed">
        <p className="muted">
          This payment hasn&apos;t been completed (status:{" "}
          <code>{session.payment_status}</code>). No certificate was issued.
        </p>
        <p style={{ marginTop: 16 }}>
          <Link href="/">Back to start</Link>
        </p>
      </Panel>
    );
  }

  const m = session.metadata ?? {};
  const email =
    session.customer_details?.email ??
    session.customer_email ??
    "unknown@example.com";

  // Issue the certificate (deterministic numbers + dates, PDF rendered in memory).
  const { certificateNumber, policyNumber, data, pdf } =
    await ensureCertificate(session);

  // We email once. Because the filesystem is ephemeral on serverless, the
  // "already emailed" flag lives on the PaymentIntent metadata, which persists
  // across requests so refreshing /success doesn't re-send.
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? null
      : (session.payment_intent as Stripe.PaymentIntent | null);
  const alreadyEmailed = paymentIntent?.metadata?.certificateEmailed === "true";

  let emailNote = alreadyEmailed
    ? `Your certificate was emailed to ${email}.`
    : "";
  if (!alreadyEmailed) {
    try {
      await sendCertificateEmail({
        to: email,
        policyholderName: data.policyholderName,
        registrationMark: data.registrationMark,
        planName: m.planName ?? "Temporary Cover",
        effectiveDate: formatDateTime(data.effectiveDate),
        expiryDate: formatDateTime(data.expiryDate),
        certificateNumber,
        policyNumber,
        pdf,
      });
      if (paymentIntent) {
        await stripe.paymentIntents.update(paymentIntent.id, {
          metadata: { ...paymentIntent.metadata, certificateEmailed: "true" },
        });
      }
      emailNote = `Your certificate has been emailed to ${email}.`;
    } catch (err) {
      console.error("Failed to email certificate:", err);
      emailNote = `We couldn't email your certificate to ${email} (check Resend config / server logs). You can still download it below.`;
    }
  }

  const downloadHref = `/api/certificate?session_id=${encodeURIComponent(
    sessionId
  )}`;
  const vehicleLine = `${m.vrm ?? ""}${m.make ? ` · ${m.make}` : ""}${
    m.model ? ` ${m.model}` : ""
  }`;
  const emailOk = alreadyEmailed || emailNote.startsWith("Your certificate");

  return (
    <Panel title="You're covered 🎉" icon>
      <p className="muted">
        Your payment was confirmed and your certificate has been issued.
      </p>

      <div className="summary">
        <Row k="Vehicle" v={vehicleLine} />
        <Row k="Plan" v={m.planName ?? "—"} />
        <Row k="Certificate no." v={certificateNumber} />
        <Row k="Policy no." v={policyNumber} />
        <Row k="Effective" v={formatDateTime(data.effectiveDate)} />
        <Row k="Expires" v={formatDateTime(data.expiryDate)} />
      </div>

      <div className={`alert ${emailOk ? "alert-ok" : "alert-warn"}`}>
        {emailNote}
      </div>

      <div className="btn-row">
        <a className="btn btn-primary" href={downloadHref} style={{ width: "auto", flex: 1 }}>
          ⬇ Download certificate (PDF)
        </a>
        <Link className="btn btn-ghost" href="/" style={{ width: "auto", flex: 1, textAlign: "center" }}>
          Insure another vehicle
        </Link>
      </div>
    </Panel>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="summary-row">
      <span className="k">{k}</span>
      <span className="v">{v || "—"}</span>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="narrow">
      <div className="card">
        {icon && <div className="success-icon">✓</div>}
        <h2 style={{ fontSize: 24 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
