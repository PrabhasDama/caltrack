export default function Loading() {
  return (
    <section
      className="secondary-page route-loading"
      role="status"
      aria-live="polite"
    >
      <span className="eyebrow">Loading your next view…</span>
      <div className="card" />
      <div className="card" />
      <span className="fine-print muted">Loading your saved information.</span>
    </section>
  );
}
