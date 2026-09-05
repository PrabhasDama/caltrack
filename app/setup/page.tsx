import Link from "next/link";
export default function Setup() {
  return (
    <main id="main" className="auth-main" style={{ minHeight: "100vh" }}>
      <section className="card form-stack" style={{ maxWidth: 540 }}>
        <Link href="/" className="brand">
          caltrack.
        </Link>
        <h1 style={{ fontSize: 27 }}>Connect your account service.</h1>
        <p className="muted">
          CalTrack stores your account and daily records securely in Supabase.
          The project owner needs to add the connection settings and apply the
          included database migrations.
        </p>
        <p className="notice">
          Setup instructions are in the project README. Your data is never
          replaced with example progress.
        </p>
        <Link href="/login" className="button primary">
          Try again
        </Link>
      </section>
    </main>
  );
}
