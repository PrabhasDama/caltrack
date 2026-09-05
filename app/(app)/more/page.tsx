import Link from "next/link";
import {
  Settings2,
  UserRound,
  ArrowUpRight,
  Leaf,
  PackageOpen,
  Wallet,
} from "lucide-react";
export const metadata = { title: "More" };
export default function More() {
  return (
    <div className="secondary-page">
      <header className="page-title">
        <span className="eyebrow">A LITTLE MORE ROOM</span>
        <h1>
          Your CalTrack space<span className="brand-dot">.</span>
        </h1>
        <p>The essentials are here. The next chapters build on them.</p>
      </header>
      <div className="info-grid">
        <Link href="/pantry" className="card more-link">
          <PackageOpen size={25} />
          <h2>Your pantry</h2>
          <p className="muted">
            Ingredients, stock levels, and expiration dates.
          </p>
          <ArrowUpRight size={17} />
        </Link>
        <Link href="/budget" className="card more-link">
          <Wallet size={25} />
          <h2>Your budget</h2>
          <p className="muted">Grocery receipts and monthly spending.</p>
          <ArrowUpRight size={17} />
        </Link>
        <Link href="/profile" className="card more-link">
          <UserRound size={25} />
          <h2>Your profile</h2>
          <p className="muted">Your information and saved preferences.</p>
          <ArrowUpRight size={17} />
        </Link>
        <Link href="/settings" className="card more-link">
          <Settings2 size={25} />
          <h2>Settings</h2>
          <p className="muted">Appearance, account, and data export.</p>
          <ArrowUpRight size={17} />
        </Link>
      </div>
      <section className="card">
        <div className="section-heading">
          <h2>
            <Leaf size={18} /> Coming in the next chapters
          </h2>
        </div>
        <p className="muted fine-print" style={{ marginTop: 15 }}>
          Expanded progress tracking and meal prep will build on your daily
          essentials. Advanced price comparison comes after these everyday
          essentials.
        </p>
      </section>
    </div>
  );
}
