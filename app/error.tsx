"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="auth-main" style={{ minHeight: "70vh" }}>
      <section className="card form-stack">
        <h1>We couldn’t load that.</h1>
        <p className="muted">
          Please try again. If this is a new installation, check that the
          database migrations have been applied.
        </p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
        <a href="/dashboard">Return to Today</a>
      </section>
    </main>
  );
}
