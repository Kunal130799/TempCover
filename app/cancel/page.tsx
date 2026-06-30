import Link from "next/link";

export default function CancelPage() {
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <h2 style={{ fontSize: 22 }}>Checkout cancelled</h2>
      <p className="muted">
        Your payment was cancelled and you have not been charged. No certificate
        was issued.
      </p>
      <div className="btn-row">
        <Link
          className="btn btn-primary"
          href="/"
          style={{ width: "auto", flex: 1, textAlign: "center" }}
        >
          Back to start
        </Link>
      </div>
    </div>
  );
}
