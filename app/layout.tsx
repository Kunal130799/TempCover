import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "TempDrive (DEMO) — Temporary motor insurance",
  description:
    "Proof-of-concept temporary insurance flow: vehicle lookup → plan → Stripe Checkout → emailed PDF certificate. Demo only, not real cover.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Persistent, prominent disclaimer on every page. This mimics a real
            regulated product, so the demo nature must never be buried. */}
        <div className="demo-banner">
          <strong>DEMO ONLY</strong> — proof-of-concept. No real insurance cover
          is provided and any certificate issued has no legal standing.
        </div>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
