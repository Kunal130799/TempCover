"use client";

import { useState } from "react";

const NAV_LINKS = [
  "Car insurance",
  "Van insurance",
  "Learner driver",
  "Help",
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="nav">
      <div className="nav-inner">
        <a className="wordmark" href="/">
          Short Drive
        </a>

        <nav className="nav-links">
          {NAV_LINKS.map((l) => (
            <a key={l} className="nav-link" href="#">
              {l}
            </a>
          ))}
        </nav>

        <div className="nav-right">
          <a className="nav-login" href="#">
            Log in
          </a>
          <button
            type="button"
            className="nav-burger"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {open && (
        <div className="nav-menu">
          {NAV_LINKS.map((l) => (
            <a key={l} href="#" onClick={() => setOpen(false)}>
              {l}
            </a>
          ))}
          <a href="#" onClick={() => setOpen(false)}>
            Log in
          </a>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <a className="wordmark" href="/">
            Short Drive
          </a>
          <div className="store-badges">
            <span className="store-badge">↧ App Store</span>
            <span className="store-badge">↧ Google Play</span>
          </div>
        </div>

        <div className="footer-cols">
          <div>
            <h4>Insurance</h4>
            <a href="#">Car insurance</a>
            <a href="#">Van insurance</a>
            <a href="#">Learner driver</a>
            <a href="#">Impounded vehicle</a>
            <a href="#">Motorbike</a>
          </div>
          <div>
            <h4>Help</h4>
            <a href="#">Who we cover</a>
            <a href="#">Claims</a>
            <a href="#">Complaints</a>
            <a href="#">Help Centre</a>
            <a href="#">Contact us</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="#">About us</a>
            <a href="#">Careers</a>
            <a href="#">Customer reviews</a>
            <a href="#">News Room</a>
          </div>
          <div>
            <h4>Legal</h4>
            <a href="#">Privacy notice</a>
            <a href="#">Cookie policy</a>
            <a href="#">Terms of business</a>
            <a href="#">Modern slavery statement</a>
          </div>
        </div>

        <p className="footer-legal">
          Short Drive is a trading name of Short Drive Insurance Services Ltd,
          registered in England and Wales. Authorised and regulated by the
          Financial Conduct Authority. © 2026 Short Drive Insurance Services Ltd.
        </p>
      </div>
    </footer>
  );
}
