import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "./site-chrome";

export const metadata: Metadata = {
  title: "TempDrive — Temporary car & van insurance from 1 hour to 28 days",
  description:
    "Quick and easy temporary vehicle insurance. Get affordable short-term cover in minutes — enter your reg, choose your duration and get covered.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main className="site-main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
