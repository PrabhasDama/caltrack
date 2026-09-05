import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="auth-main" style={{ minHeight: "100vh" }}>
      <section className="form-stack">
        <span className="eyebrow">404 / A SMALL DETOUR</span>
        <h1>That page isn’t here.</h1>
        <Link className="button primary" href="/dashboard">
          Back to Today
        </Link>
      </section>
    </main>
  );
}
