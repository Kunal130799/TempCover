"use client";

import { useState } from "react";
import { PLANS, formatGBP } from "@/lib/plans";
import type { VehicleDetails } from "@/lib/vehicle";

type Step = "lookup" | "plan";

const POPULAR_PLAN_ID = "3day";

export default function HomePage() {
  const [step, setStep] = useState<Step>("lookup");
  const [vrm, setVrm] = useState("");
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);

  const [planId, setPlanId] = useState(POPULAR_PLAN_ID);
  const [policyholderName, setPolicyholderName] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vehicle-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vrm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setVehicle(data.vehicle as VehicleDetails);
      setStep("plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, email, policyholderName, vehicle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <>
      <Brand />
      <Stepper step={step} />

      {step === "lookup" && (
        <div className="card">
          <h2>Find your vehicle</h2>
          <p className="sub">Enter your registration to get a quote.</p>
          <form onSubmit={handleLookup}>
            <div className="field">
              <label htmlFor="vrm">Vehicle registration</label>
              <input
                id="vrm"
                className="input input-reg"
                value={vrm}
                onChange={(e) => setVrm(e.target.value.toUpperCase())}
                placeholder="NV19 WMK"
                required
                autoFocus
                autoComplete="off"
              />
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Looking up…" : "Look up vehicle"}
            </button>
          </form>
        </div>
      )}

      {step === "plan" && vehicle && (
        <>
          <div className="card">
            <div className="card-head">
              <h2>Your vehicle</h2>
              <button
                type="button"
                className="linkbtn"
                onClick={() => {
                  setStep("lookup");
                  setError(null);
                }}
              >
                Change
              </button>
            </div>

            <Plate reg={vehicle.vrm} />

            <div className="vehicle-grid">
              <Detail k="Make" v={vehicle.make} />
              <Detail k="Model" v={vehicle.model} />
              <Detail k="Colour" v={vehicle.colour} />
              <Detail k="Fuel" v={vehicle.fuelType} />
              <Detail k="Year" v={vehicle.year} />
              <Detail
                k="Engine"
                v={vehicle.engineCapacity ? `${vehicle.engineCapacity} cc` : ""}
              />
              <Detail k="MOT" v={vehicle.motStatus} status />
              <Detail k="Tax" v={vehicle.taxStatus} status />
            </div>
          </div>

          <div className="card">
            <h2>Choose your cover</h2>
            <p className="sub">Temporary cover for {vehicle.vrm}.</p>
            <form onSubmit={handleCheckout}>
              <div className="plans">
                {PLANS.map((p) => {
                  const selected = p.id === planId;
                  return (
                    <label
                      key={p.id}
                      className={`plan${selected ? " selected" : ""}`}
                    >
                      {p.id === POPULAR_PLAN_ID && (
                        <span className="plan-badge">Most popular</span>
                      )}
                      <input
                        type="radio"
                        name="plan"
                        value={p.id}
                        checked={selected}
                        onChange={() => setPlanId(p.id)}
                      />
                      <span className="plan-body">
                        <span className="plan-name">{p.name}</span>
                        <span className="plan-blurb">{p.blurb}</span>
                      </span>
                      <span className="plan-price">{formatGBP(p.priceInPence)}</span>
                    </label>
                  );
                })}
              </div>

              <div className="field" style={{ marginTop: 20 }}>
                <label htmlFor="name">Policyholder full name</label>
                <input
                  id="name"
                  className="input"
                  value={policyholderName}
                  onChange={(e) => setPolicyholderName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  required
                />
                <span className="hint">
                  Your certificate PDF will be emailed here.
                </span>
              </div>

              {error && <div className="alert alert-error">{error}</div>}
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Redirecting…" : "Continue to secure payment"}
              </button>
              <p className="fineprint">
                Test card <code>4242 4242 4242 4242</code> · any future expiry &amp;
                CVC
              </p>
            </form>
          </div>
        </>
      )}
    </>
  );
}

/* ---------- presentational helpers ---------- */

function Brand() {
  return (
    <header className="brand">
      <span className="brand-badge">TD</span>
      <div>
        <h1 className="brand-name">TempDrive</h1>
        <p className="brand-tag">Temporary motor insurance, done properly.</p>
      </div>
    </header>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = ["Vehicle", "Cover", "Pay"];
  const current = step === "lookup" ? 0 : 1;
  return (
    <div className="stepper">
      {steps.map((label, i) => (
        <div key={label} style={{ display: "contents" }}>
          <div
            className={`step${i === current ? " active" : ""}${
              i < current ? " done" : ""
            }`}
          >
            <span className="step-dot">{i < current ? "✓" : i + 1}</span>
            {label}
          </div>
          {i < steps.length - 1 && <span className="step-line" />}
        </div>
      ))}
    </div>
  );
}

function Plate({ reg }: { reg: string }) {
  return (
    <div className="plate" aria-label={`Registration ${reg}`}>
      <span className="plate-gb">
        <span className="stars">★</span>
        UK
      </span>
      <span className="plate-reg">{reg}</span>
    </div>
  );
}

function Detail({
  k,
  v,
  status,
}: {
  k: string;
  v: string;
  status?: boolean;
}) {
  const value = v || "—";
  let pill: string | null = null;
  if (status && v) {
    const ok = /valid|taxed|^yes$/i.test(v);
    pill = ok ? "pill-ok" : "pill-warn";
  }
  return (
    <div className="detail">
      <div className="k">{k}</div>
      <div className="v">
        {pill ? <span className={`pill ${pill}`}>{value}</span> : value}
      </div>
    </div>
  );
}
