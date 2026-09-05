import Link from "next/link";
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Link href="/" className="brand">
          <span className="brand-mark">c</span>caltrack.
        </Link>
        <div>
          <span className="eyebrow">PROGRESS, AT YOUR PACE</span>
          <h2>
            A little intention.
            <br />A better every day.
          </h2>
          <p>
            Your goals, nutrition, and daily habits deserve a place that feels
            simple.
          </p>
        </div>
        <footer>Eat better. Spend smarter. Reach your goal.</footer>
      </aside>
      <main id="main" className="auth-main">
        {children}
      </main>
    </div>
  );
}
