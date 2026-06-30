import fs from "node:fs";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ensureCertificate } from "@/lib/issue";

export const dynamic = "force-dynamic";

/**
 * Stream the certificate PDF for a paid Checkout Session as a download.
 * GET /api/certificate?session_id=cs_test_...
 */
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id." }, { status: 400 });
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json(
      { error: "Could not find that checkout session." },
      { status: 404 }
    );
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json(
      { error: "No certificate is available for an unpaid session." },
      { status: 403 }
    );
  }

  const { pointer, pdfPath } = await ensureCertificate(session);
  const pdf = fs.readFileSync(pdfPath);

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pointer.certificateNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
