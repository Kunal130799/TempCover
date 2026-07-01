"use client";

import { useMemo, useState } from "react";
import {
  clampDuration,
  durationLabel,
  DURATION_LIMITS,
  formatGBP,
  priceFor,
  type DurationUnit,
} from "@/lib/plans";
import type { VehicleDetails } from "@/lib/vehicle";

type Step = "start" | "account" | "details" | "quote";

const LICENCE_TYPES = [
  "Full UK licence",
  "Full Northern Ireland licence",
  "Full EU licence",
  "Full International licence",
  "Provisional UK licence",
];
const TITLES = ["Mr", "Mrs", "Miss", "Ms"];
const REASONS = [
  "Borrowing a vehicle",
  "Buying or selling a vehicle",
  "Learning to drive",
  "Business use",
  "Sharing driving on a long journey",
  "Other",
];

const QUICK_DURATIONS: { label: string; unit: DurationUnit; value: number }[] = [
  { label: "1 day", unit: "days", value: 1 },
  { label: "2 days", unit: "days", value: 2 },
  { label: "1 week", unit: "weeks", value: 1 },
];

interface Driver {
  licenceType: string;
  title: string;
  firstName: string;
  lastName: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  postcode: string;
}

const EMPTY_DRIVER: Driver = {
  licenceType: "",
  title: "",
  firstName: "",
  lastName: "",
  dobDay: "",
  dobMonth: "",
  dobYear: "",
  postcode: "",
};

export default function HomePage() {
  const [step, setStep] = useState<Step>("start");

  // Quote inputs
  const [vrm, setVrm] = useState("");
  const [vehicle, setVehicle] = useState<VehicleDetails | null>(null);
  const [unit, setUnit] = useState<DurationUnit>("days");
  const [value, setValue] = useState(1);

  // Details
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [coverStartMode, setCoverStartMode] = useState<"immediate" | "date">(
    "immediate"
  );
  const [coverStartDate, setCoverStartDate] = useState("");
  const [driver, setDriver] = useState<Driver>(EMPTY_DRIVER);
  const [reasonForCover, setReasonForCover] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const price = useMemo(() => priceFor(unit, value), [unit, value]);
  const fullName = `${driver.title} ${driver.firstName} ${driver.lastName}`
    .replace(/\s+/g, " ")
    .trim();

  function setDriverField(k: keyof Driver, v: string) {
    setDriver((d) => ({ ...d, [k]: v }));
  }

  function pickUnit(u: DurationUnit) {
    setUnit(u);
    setValue((v) => clampDuration(u, v));
  }

  // ---- Step 1 → lookup vehicle, then account gate ------------------------
  async function handleStart() {
    setError(null);
    if (!vrm.trim()) {
      setError("Please enter your vehicle registration.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/vehicle-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vrm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setVehicle(data.vehicle as VehicleDetails);
      setStep("account");
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // ---- Step 3 → validate details ----------------------------------------
  function validateDetails(): boolean {
    const e: Record<string, string> = {};
    if (!phone.trim()) e.phone = "Mobile number is required";
    if (!email.includes("@")) e.email = "A valid email is required";
    if (coverStartMode === "date" && !coverStartDate)
      e.coverStart = "Please choose a start day";
    if (!driver.licenceType) e.licenceType = "Licence type is required";
    if (!driver.title) e.title = "Title is required";
    if (driver.firstName.trim().length < 2)
      e.firstName = "First name must be at least 2 characters";
    if (driver.lastName.trim().length < 2)
      e.lastName = "Last name must be at least 2 characters";
    const d = Number(driver.dobDay);
    const mo = Number(driver.dobMonth);
    const y = Number(driver.dobYear);
    if (!(d >= 1 && d <= 31)) e.dobDay = "Please enter a valid day (1-31)";
    else if (!(mo >= 1 && mo <= 12)) e.dobMonth = "Please enter a valid month (1-12)";
    else if (!(y >= 1900 && y <= 2010)) e.dobYear = "Please enter a valid year";
    if (!driver.postcode.trim()) e.postcode = "Postcode is required";
    if (!reasonForCover) e.reason = "Please tell us your reason for cover";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleDetailsContinue() {
    if (validateDetails()) {
      setError(null);
      setStep("quote");
      window.scrollTo({ top: 0 });
    }
  }

  // ---- Step 4 → Stripe checkout -----------------------------------------
  async function handleCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          phone,
          policyholderName: fullName,
          vehicle,
          durationUnit: unit,
          durationValue: value,
          coverStart: coverStartMode === "date" ? coverStartDate : "immediate",
          driver: {
            licenceType: driver.licenceType,
            postcode: driver.postcode,
          },
          reasonForCover,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (step === "start") {
    return (
      <StartStep
        vrm={vrm}
        setVrm={setVrm}
        unit={unit}
        value={value}
        pickUnit={pickUnit}
        setValue={setValue}
        onContinue={handleStart}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <div className="narrow">
      {step === "account" && (
        <AccountStep onGuest={() => setStep("details")} />
      )}

      {step === "details" && vehicle && (
        <DetailsStep
          vehicle={vehicle}
          onEditVehicle={() => setStep("start")}
          unit={unit}
          value={value}
          pickUnit={pickUnit}
          setValue={setValue}
          phone={phone}
          setPhone={setPhone}
          email={email}
          setEmail={setEmail}
          coverStartMode={coverStartMode}
          setCoverStartMode={setCoverStartMode}
          coverStartDate={coverStartDate}
          setCoverStartDate={setCoverStartDate}
          driver={driver}
          setDriverField={setDriverField}
          reasonForCover={reasonForCover}
          setReasonForCover={setReasonForCover}
          errors={errors}
          onContinue={handleDetailsContinue}
        />
      )}

      {step === "quote" && vehicle && (
        <QuoteStep
          vehicle={vehicle}
          unit={unit}
          value={value}
          price={price}
          coverStartMode={coverStartMode}
          coverStartDate={coverStartDate}
          fullName={fullName}
          email={email}
          onBack={() => setStep("details")}
          onPay={handleCheckout}
          loading={loading}
          error={error}
        />
      )}
    </div>
  );
}

/* =========================================================================
   Step 1 — hero + quote start (full-width homepage)
   ========================================================================= */

function StartStep(props: {
  vrm: string;
  setVrm: (v: string) => void;
  unit: DurationUnit;
  value: number;
  pickUnit: (u: DurationUnit) => void;
  setValue: (n: number) => void;
  onContinue: () => void;
  loading: boolean;
  error: string | null;
}) {
  const { vrm, setVrm, unit, value, pickUnit, setValue, onContinue, loading, error } =
    props;

  return (
    <>
      <section className="hero-wrap">
        <div className="hero-inner">
          <div className="hero-copy">
            <h1>Quick &amp; Easy Temporary Insurance</h1>
            <p className="lede">Get affordable cover, unbelievably fast.</p>
            <ul className="hero-points">
              <li>Cover from 1 hour to 28 days</li>
              <li>Comprehensive cover as standard</li>
              <li>Instant cover, sorted in minutes</li>
            </ul>
            <div className="trust">
              <span className="stars">★★★★★</span>
              <strong>Excellent</strong>
              <span className="muted">· 50,000+ reviews</span>
            </div>
          </div>

          <div className="quote-card">
            <div className="prompt-label">
              To get started, tell us the reg of the car or van you want cover for
            </div>
            <PlateInput vrm={vrm} setVrm={setVrm} />
            <button
              type="button"
              className="reg-link"
              onClick={() => document.getElementById("reg-input")?.focus()}
            >
              I don&apos;t know my reg yet
            </button>

            <div className="prompt-label">Can we guess how long you need cover for?</div>
            <div className="seg">
              {QUICK_DURATIONS.map((q) => {
                const selected = q.unit === unit && q.value === value;
                return (
                  <button
                    key={q.label}
                    type="button"
                    className={`seg-btn${selected ? " selected" : ""}`}
                    onClick={() => {
                      pickUnit(q.unit);
                      setValue(q.value);
                    }}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>

            <div className="prompt-label">Maybe not, choose your own duration</div>
            <UnitToggle unit={unit} pickUnit={pickUnit} />
            <QuantityGrid unit={unit} value={value} setValue={setValue} />

            {error && (
              <div className="alert alert-error" style={{ marginTop: 16 }}>
                {error}
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 18 }}
              onClick={onContinue}
              disabled={loading}
            >
              {loading ? "Finding your vehicle…" : "Continue"}
            </button>
          </div>
        </div>
      </section>

      <div className="container">
        <Marketing />
      </div>
    </>
  );
}

/* =========================================================================
   Step 2 — account gate
   ========================================================================= */

function AccountStep({ onGuest }: { onGuest: () => void }) {
  return (
    <div className="card">
      <h2>Sign in or create an account</h2>
      <ul className="benefits">
        <li>Get faster quotes with stored details</li>
        <li>Easy access to your policy documents</li>
        <li>View your policy history</li>
        <li>Exclusive discounts in the app</li>
      </ul>

      <button type="button" className="provider-btn" onClick={onGuest}>
        ✉️ Continue with Email
      </button>
      <button type="button" className="provider-btn" onClick={onGuest}>
        🇬 Continue with Google
      </button>
      <button type="button" className="provider-btn" onClick={onGuest}>
        Continue with Apple
      </button>

      <div className="divider">OR</div>

      <button type="button" className="btn btn-outline" onClick={onGuest}>
        Continue as guest
      </button>
    </div>
  );
}

/* =========================================================================
   Step 3 — enter your details
   ========================================================================= */

function DetailsStep(props: {
  vehicle: VehicleDetails;
  onEditVehicle: () => void;
  unit: DurationUnit;
  value: number;
  pickUnit: (u: DurationUnit) => void;
  setValue: (n: number) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  coverStartMode: "immediate" | "date";
  setCoverStartMode: (m: "immediate" | "date") => void;
  coverStartDate: string;
  setCoverStartDate: (v: string) => void;
  driver: Driver;
  setDriverField: (k: keyof Driver, v: string) => void;
  reasonForCover: string;
  setReasonForCover: (v: string) => void;
  errors: Record<string, string>;
  onContinue: () => void;
}) {
  const {
    vehicle,
    onEditVehicle,
    unit,
    value,
    pickUnit,
    setValue,
    phone,
    setPhone,
    email,
    setEmail,
    coverStartMode,
    setCoverStartMode,
    coverStartDate,
    setCoverStartDate,
    driver,
    setDriverField,
    reasonForCover,
    setReasonForCover,
    errors,
    onContinue,
  } = props;

  const dayOptions = useMemo(() => buildDayOptions(), []);

  return (
    <div className="card">
      <h2 style={{ fontSize: 26 }}>Enter your details</h2>

      {/* --- Contact --- */}
      <div className="section-title">Your contact details</div>
      <Field label="Your phone number" error={errors.phone}>
        <input
          className={`input${errors.phone ? " invalid" : ""}`}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Enter phone number"
          inputMode="tel"
        />
      </Field>
      <Field label="Your email" error={errors.email}>
        <input
          className={`input${errors.email ? " invalid" : ""}`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email"
        />
      </Field>

      {/* --- Vehicle --- */}
      <div className="section-title">Vehicle to be covered</div>
      <div className="vehicle-head">
        <div>
          <div className="vehicle-name">{vehicle.make || "Vehicle"}</div>
          <div className="vehicle-model">{vehicle.model}</div>
        </div>
        <button type="button" className="edit-btn" onClick={onEditVehicle}>
          ✎ Edit
        </button>
      </div>
      <div style={{ marginTop: 10 }}>
        <Plate reg={vehicle.vrm} />
      </div>

      {/* --- Cover details --- */}
      <div className="section-title">Cover details</div>
      <div className="prompt-label" style={{ marginTop: 0 }}>
        How long do you need cover for?
      </div>
      <UnitToggle unit={unit} pickUnit={pickUnit} />
      <QuantityGrid unit={unit} value={value} setValue={setValue} />

      <div className="prompt-label">…and when do you want the cover to start?</div>
      <label className={`radio-row${coverStartMode === "immediate" ? " selected" : ""}`}>
        <input
          type="radio"
          name="coverStart"
          checked={coverStartMode === "immediate"}
          onChange={() => setCoverStartMode("immediate")}
        />
        <span className="rr-title">Immediately</span>
      </label>
      <label className={`radio-row${coverStartMode === "date" ? " selected" : ""}`}>
        <input
          type="radio"
          name="coverStart"
          checked={coverStartMode === "date"}
          onChange={() => setCoverStartMode("date")}
        />
        <span className="rr-title">Select day</span>
      </label>
      {coverStartMode === "date" && (
        <Field label="Start day" error={errors.coverStart}>
          <select
            className={`select${errors.coverStart ? " invalid" : ""}`}
            value={coverStartDate}
            onChange={(e) => setCoverStartDate(e.target.value)}
          >
            <option value="">Select day</option>
            {dayOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      )}
      <p className="finehelp">
        Policies starting immediately will begin a few minutes after you buy your
        policy. You will see the exact start and end date/time on screen and in
        your documents after you buy.
      </p>

      {/* --- Driver --- */}
      <div className="section-title">About the driver</div>
      <div className="callout">
        <span className="callout-icon">ⓘ</span>
        <span>To secure a quote, details must exactly match the driver&apos;s licence.</span>
      </div>

      <Field label="Driver's licence type" error={errors.licenceType}>
        <select
          className={`select${errors.licenceType ? " invalid" : ""}`}
          value={driver.licenceType}
          onChange={(e) => setDriverField("licenceType", e.target.value)}
        >
          <option value="">Please select</option>
          {LICENCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Driver's title" error={errors.title}>
        <select
          className={`select${errors.title ? " invalid" : ""}`}
          value={driver.title}
          onChange={(e) => setDriverField("title", e.target.value)}
        >
          <option value="">Please select</option>
          {TITLES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Driver's first name" error={errors.firstName}>
        <input
          className={`input${errors.firstName ? " invalid" : ""}`}
          value={driver.firstName}
          onChange={(e) => setDriverField("firstName", e.target.value)}
          placeholder="First name"
        />
      </Field>
      <Field label="Driver's last name" error={errors.lastName}>
        <input
          className={`input${errors.lastName ? " invalid" : ""}`}
          value={driver.lastName}
          onChange={(e) => setDriverField("lastName", e.target.value)}
          placeholder="Last name"
        />
      </Field>

      <Field
        label="Driver's date of birth"
        error={errors.dobDay || errors.dobMonth || errors.dobYear}
      >
        <div className="dob-row">
          <input
            className={`input${errors.dobDay ? " invalid" : ""}`}
            value={driver.dobDay}
            onChange={(e) => setDriverField("dobDay", e.target.value)}
            placeholder="DD"
            inputMode="numeric"
            maxLength={2}
          />
          <input
            className={`input${errors.dobMonth ? " invalid" : ""}`}
            value={driver.dobMonth}
            onChange={(e) => setDriverField("dobMonth", e.target.value)}
            placeholder="MM"
            inputMode="numeric"
            maxLength={2}
          />
          <input
            className={`input${errors.dobYear ? " invalid" : ""}`}
            value={driver.dobYear}
            onChange={(e) => setDriverField("dobYear", e.target.value)}
            placeholder="YYYY"
            inputMode="numeric"
            maxLength={4}
          />
        </div>
      </Field>

      <Field label="Driver's postcode" error={errors.postcode}>
        <div className="inline-row">
          <input
            className={`input${errors.postcode ? " invalid" : ""}`}
            value={driver.postcode}
            onChange={(e) => setDriverField("postcode", e.target.value.toUpperCase())}
            placeholder="Postcode"
          />
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: "auto", whiteSpace: "nowrap" }}
            onClick={() => document.querySelector<HTMLInputElement>('input[placeholder="Postcode"]')?.focus()}
          >
            Find address
          </button>
        </div>
      </Field>

      {/* --- We still need to know --- */}
      <div className="section-title">We still need to know</div>
      <Field label="Reason for cover" error={errors.reason}>
        <select
          className={`select${errors.reason ? " invalid" : ""}`}
          value={reasonForCover}
          onChange={(e) => setReasonForCover(e.target.value)}
        >
          <option value="">Please select</option>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <p className="finehelp">
        To process your application we will verify your identity and may check
        your details with credit reference and fraud prevention agencies. By
        clicking &apos;continue&apos;, you confirm you have read and agree to the
        customer terms of business and privacy policy.
      </p>

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 18 }}
        onClick={onContinue}
      >
        Continue
      </button>
    </div>
  );
}

/* =========================================================================
   Step 4 — quote summary + pay
   ========================================================================= */

function QuoteStep(props: {
  vehicle: VehicleDetails;
  unit: DurationUnit;
  value: number;
  price: number;
  coverStartMode: "immediate" | "date";
  coverStartDate: string;
  fullName: string;
  email: string;
  onBack: () => void;
  onPay: () => void;
  loading: boolean;
  error: string | null;
}) {
  const {
    vehicle,
    unit,
    value,
    price,
    coverStartMode,
    coverStartDate,
    fullName,
    email,
    onBack,
    onPay,
    loading,
    error,
  } = props;

  const startLabel =
    coverStartMode === "immediate"
      ? "Immediately"
      : formatDayLabel(new Date(`${coverStartDate}T00:00:00`));

  return (
    <div className="card">
      <div className="card-head">
        <h2>Your quote</h2>
        <button type="button" className="linkbtn" onClick={onBack}>
          Edit details
        </button>
      </div>

      <div className="price-hero">
        <span className="muted">{durationLabel(unit, value)} of cover</span>
        <span className="price">{formatGBP(price)}</span>
      </div>

      <div style={{ marginBottom: 4 }}>
        <Plate reg={vehicle.vrm} />
      </div>

      <div className="summary">
        <Row k="Vehicle" v={`${vehicle.make} ${vehicle.model}`.trim()} />
        <Row k="Duration" v={durationLabel(unit, value)} />
        <Row k="Cover starts" v={startLabel} />
        <Row k="Policyholder" v={fullName || "—"} />
        <Row k="Email" v={email} />
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      <button
        type="button"
        className="btn btn-primary"
        onClick={onPay}
        disabled={loading}
      >
        {loading ? "Redirecting…" : "Continue to secure payment"}
      </button>
      <p className="fineprint">Payments are processed securely by Stripe.</p>
    </div>
  );
}

/* =========================================================================
   Shared presentational helpers
   ========================================================================= */

function PlateInput({
  vrm,
  setVrm,
}: {
  vrm: string;
  setVrm: (v: string) => void;
}) {
  return (
    <div className="plate-input">
      <span className="reg-gb">
        <span className="stars">★</span>
        GB
      </span>
      <input
        id="reg-input"
        value={vrm}
        onChange={(e) => setVrm(e.target.value.toUpperCase())}
        placeholder="YOUR REG"
        autoComplete="off"
        aria-label="Vehicle registration"
      />
    </div>
  );
}

function UnitToggle({
  unit,
  pickUnit,
}: {
  unit: DurationUnit;
  pickUnit: (u: DurationUnit) => void;
}) {
  const units: DurationUnit[] = ["hours", "days", "weeks"];
  return (
    <div className="seg">
      {units.map((u) => (
        <button
          key={u}
          type="button"
          className={`seg-btn${u === unit ? " selected" : ""}`}
          onClick={() => pickUnit(u)}
        >
          {u.charAt(0).toUpperCase() + u.slice(1)}
        </button>
      ))}
    </div>
  );
}

function QuantityGrid({
  unit,
  value,
  setValue,
}: {
  unit: DurationUnit;
  value: number;
  setValue: (n: number) => void;
}) {
  const { max } = DURATION_LIMITS[unit];
  const [expanded, setExpanded] = useState(false);
  const initial = Math.min(7, max);
  const shown = expanded ? max : initial;
  const numbers = Array.from({ length: shown }, (_, i) => i + 1);

  return (
    <>
      <div className="qty-grid">
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            className={`qty-tile${n === value ? " selected" : ""}`}
            onClick={() => setValue(n)}
          >
            {n}
          </button>
        ))}
      </div>
      {!expanded && max > initial && (
        <button type="button" className="qty-more" onClick={() => setExpanded(true)}>
          + See more {unit}
        </button>
      )}
    </>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

function Plate({ reg }: { reg: string }) {
  return (
    <div className="plate" aria-label={`Registration ${reg}`}>
      <span className="plate-gb">
        <span className="stars">★</span>
        GB
      </span>
      <span className="plate-reg">{reg}</span>
    </div>
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

function Marketing() {
  return (
    <div className="mkt">
      <h2>Choose short-term cover that&apos;s right for you</h2>
      <div className="mkt-grid">
        <div className="mkt-card">
          <h3>🚗 Temporary car insurance</h3>
          <p>
            Drivers aged 17–78 can easily find flexible short-term car insurance
            from 1 hour to 28 days — ideal for a range of everyday situations.
          </p>
        </div>
        <div className="mkt-card">
          <h3>🚐 Temporary van insurance</h3>
          <p>
            Short-term van cover for moving house, borrowing a van or picking up
            a large item — sorted in minutes.
          </p>
        </div>
        <div className="mkt-card">
          <h3>🎓 Learner driver insurance</h3>
          <p>
            Practise in a friend or family member&apos;s car with cover that
            protects their no-claims bonus.
          </p>
        </div>
      </div>

      <h2>Why choose tempdrive?</h2>
      <div className="mkt-grid">
        <div className="mkt-card">
          <h3>👍 A leading provider</h3>
          <p>
            Since 2006, we&apos;ve delivered short-term insurance products for 2.5
            million drivers.
          </p>
        </div>
        <div className="mkt-card">
          <h3>⚡ A price in under 2 minutes</h3>
          <p>
            We&apos;ve removed the difficult questions most insurers ask, so
            getting a quote is quick and easy.
          </p>
        </div>
        <div className="mkt-card">
          <h3>📱 Manage cover on the app</h3>
          <p>
            Get quotes and manage your documents on mobile, tablet and desktop —
            24/7.
          </p>
        </div>
      </div>

      <h2>Our customers love us</h2>
      <div className="mkt-card" style={{ marginBottom: 16 }}>
        <div className="trust">
          <span className="stars">★★★★★</span>
          <strong>Excellent</strong>
          <span className="muted">· 50,000+ reviews</span>
        </div>
      </div>
      <div className="mkt-grid">
        <div className="mkt-card quote-block">
          <h3>Great company</h3>
          <p>
            Easy to use, straightforward, organised and no silly irrelevant
            questions. Cheap and reliable temporary cover — these guys will be the
            ones I choose!
          </p>
          <div className="who">Phil</div>
        </div>
        <div className="mkt-card quote-block">
          <p>
            Whether you&apos;re borrowing a car, moving house, visiting friends and
            family, or learning to drive, temporary insurance can help you find the
            cover you need and get peace of mind on the road.
          </p>
          <div className="who">Marc Pell · Chief Operating Officer</div>
        </div>
      </div>

      <h2>What does temporary insurance cover?</h2>
      <div className="mkt-grid">
        <div className="mkt-card">
          <h3>Included as standard</h3>
          <ul className="cover-list">
            <li>Accidental and malicious damage to your car</li>
            <li>Injury or damage to another person or their property</li>
            <li>Driving in the UK</li>
            <li>In some cases, driving in the EU (third-party level)</li>
          </ul>
        </div>
        <div className="mkt-card">
          <h3>Optional extras</h3>
          <ul className="cover-list">
            <li>Legal Expenses Cover providing up to £100,000 for legal costs</li>
            <li>Excess Reduction Cover, reducing your policy excess</li>
          </ul>
        </div>
      </div>

      <div className="mkt-card center" style={{ marginTop: 16 }}>
        <span className="award">🏆 UK Business &amp; Innovation Awards</span>
        <p>Best Customer Service</p>
      </div>
    </div>
  );
}

/* ---- date helpers ------------------------------------------------------- */

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatDayLabel(d: Date) {
  const wd = d.toLocaleDateString("en-GB", { weekday: "short" });
  const mo = d.toLocaleDateString("en-GB", { month: "short" });
  return `${wd} ${ordinal(d.getDate())} ${mo} ${d.getFullYear()}`;
}

function buildDayOptions() {
  const opts: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = 0; i < 28; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    opts.push({ value, label: formatDayLabel(d) });
  }
  return opts;
}
