import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  clampDuration,
  durationHoursFor,
  durationLabel,
  isDurationUnit,
  priceFor,
} from "@/lib/plans";
import { compactVrm, formatVrm } from "@/lib/vehicle";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      email,
      phone,
      policyholderName,
      vehicle,
      durationUnit,
      durationValue,
      coverStart,
      driver,
      reasonForCover,
    } = body ?? {};

    if (!isDurationUnit(durationUnit)) {
      return NextResponse.json(
        { error: "Please choose how long you need cover for." },
        { status: 400 }
      );
    }
    const value = clampDuration(durationUnit, Number(durationValue));

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!policyholderName || typeof policyholderName !== "string") {
      return NextResponse.json(
        { error: "Policyholder name is required." },
        { status: 400 }
      );
    }

    const compact = compactVrm(String(vehicle?.vrm ?? ""));
    if (!compact) {
      return NextResponse.json(
        { error: "Vehicle registration is missing." },
        { status: 400 }
      );
    }

    const priceInPence = priceFor(durationUnit, value);
    const label = durationLabel(durationUnit, value);
    const planName = `${label.charAt(0).toUpperCase()}${label.slice(1)} cover`;

    // "immediate" or an ISO date string (YYYY-MM-DD) chosen by the customer.
    const coverStartMeta =
      typeof coverStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(coverStart)
        ? coverStart
        : "immediate";

    const origin =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "http://localhost:3000";

    // Only the essential fields go into metadata (Stripe values must be strings
    // and have size limits). The certificate is rebuilt from these on /success.
    const metadata: Record<string, string> = {
      vrm: formatVrm(compact),
      vrmCompact: compact,
      make: String(vehicle?.make ?? ""),
      model: String(vehicle?.model ?? ""),
      colour: String(vehicle?.colour ?? ""),
      fuelType: String(vehicle?.fuelType ?? ""),
      year: String(vehicle?.year ?? ""),
      policyholderName: policyholderName.trim().slice(0, 200),
      phone: String(phone ?? "").slice(0, 40),
      planName,
      durationUnit,
      durationValue: String(value),
      planDurationHours: String(durationHoursFor(durationUnit, value)),
      coverStart: coverStartMeta,
      driverLicenceType: String(driver?.licenceType ?? "").slice(0, 60),
      reasonForCover: String(reasonForCover ?? "").slice(0, 80),
      motStatus: String(vehicle?.motStatus ?? ""),
      motDueDate: String(vehicle?.motDueDate ?? ""),
      taxStatus: String(vehicle?.taxStatus ?? ""),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      metadata,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: priceInPence,
            product_data: {
              name: `TempDrive ${planName}`,
              description: `Temporary cover for ${metadata.vrm} — ${label}`,
            },
          },
        },
      ],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Failed to create checkout session:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
