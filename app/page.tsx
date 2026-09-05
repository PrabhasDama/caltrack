import Link from "next/link";
export default function Home() {
  return (
    <main id="main" className="landing">
      <nav className="landing-nav">
        <Link href="/" className="brand">
          <span className="brand-mark">c</span>caltrack
          <span className="brand-dot">.</span>
        </Link>
        <div className="nav-actions">
          <Link href="/login">Log in</Link>
          <Link className="button primary" href="/signup">
            Get started ↗
          </Link>
        </div>
      </nav>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">● SMALL HABITS. REAL PROGRESS.</span>
          <h1>
            Eat better.
            <br />
            Spend smarter.
            <br />
            <span>Reach your goal.</span>
          </h1>
          <p>
            Connect the way you eat with the way you want to feel. Your
            nutrition, daily habits, and progress, together in one calm place.
          </p>
          <div className="hero-actions">
            <Link className="button primary large" href="/signup">
              Get started free ↗
            </Link>
            <a href="#how-it-works" className="text-link">
              Meet your daily rhythm ↓
            </a>
          </div>
          <div className="hero-note">
            <span>✓ Personal to you</span>
            <span>✓ Private by default</span>
            <span>✓ One day at a time</span>
          </div>
        </div>
        <div
          className="hero-visual"
          aria-label="Illustrative CalTrack daily dashboard"
        >
          <div className="preview-top">
            <span className="brand small">
              <span className="brand-mark">c</span>caltrack.
            </span>
            <span className="pill">A little better, every day</span>
          </div>
          <div className="preview-greeting">
            <span className="eyebrow">YOUR DAILY RHYTHM</span>
            <h2>
              Make today count<span className="brand-dot">.</span>
            </h2>
            <p>Small steps add up to something good.</p>
          </div>
          <div className="preview-balance">
            <div>
              <span className="label">DAILY NUTRITION</span>
              <h3>
                Your goals.
                <br />
                Your pace.
              </h3>
              <span className="pill">Built around you</span>
            </div>
            <div className="preview-ring">
              <span>
                One
                <br />
                <strong>good day</strong>
              </span>
            </div>
          </div>
          <div className="preview-cards">
            <div>
              <span>01 / NOURISH</span>
              <h4>Eat with intention</h4>
              <div className="mini-bar">
                <i />
              </div>
              <p>Targets that fit your life</p>
            </div>
            <div>
              <span>02 / MOVE</span>
              <h4>Show up for yourself</h4>
              <div className="week-dots">
                <b>M</b>
                <b>T</b>
                <b>W</b>
                <b>T</b>
                <b>F</b>
                <b>S</b>
                <b>S</b>
              </div>
              <p>Build consistency, gently</p>
            </div>
          </div>
          <div className="preview-footer">
            <span>03 / REFLECT</span>
            <p>Progress is a practice, not a perfect day.</p>
            <span>↗</span>
          </div>
          <span className="illustration-label">
            Illustrative preview · your account starts fresh
          </span>
        </div>
      </section>
      <section className="landing-features" id="how-it-works">
        <div>
          <span className="eyebrow">A SIMPLER WAY FORWARD</span>
          <h2>A plan you can actually live with.</h2>
        </div>
        <article>
          <span className="feature-index">01</span>
          <h3>Start with your goal</h3>
          <p>
            Set personal nutrition targets and food preferences, with clear
            assumptions and room to adjust.
          </p>
        </article>
        <article>
          <span className="feature-index">02</span>
          <h3>Keep today simple</h3>
          <p>
            Check off meals, log water, record a workout, and weigh in. A few
            moments to stay connected.
          </p>
        </article>
        <article>
          <span className="feature-index">03</span>
          <h3>Build your foundation</h3>
          <p>
            Save your grocery budget and store preferences now. Meal planning
            and shopping tools are coming next.
          </p>
        </article>
      </section>
      <section className="landing-cta">
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS SMALL</span>
          <h2>Let’s make room for better.</h2>
        </div>
        <Link className="button primary large" href="/signup">
          Create your free account ↗
        </Link>
      </section>
      <footer className="landing-footer">
        <span className="brand small">caltrack.</span>
        <p>Eat better. Spend smarter. Reach your goal.</p>
        <span>Nutrition guidance, not medical advice.</span>
      </footer>
    </main>
  );
}
