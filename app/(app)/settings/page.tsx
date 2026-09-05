import Link from "next/link";
import { ArrowUpRight, LogOut, Download } from "lucide-react";
import { SettingsPanel } from "@/components/layout/settings-panel";
import { logout } from "@/app/auth/actions";
export const metadata = { title: "Settings" };
export default function Settings() {
  return (
    <div className="secondary-page">
      <header className="page-title">
        <span className="eyebrow">YOUR SPACE, YOUR WAY</span>
        <h1>
          A few personal touches<span className="brand-dot">.</span>
        </h1>
        <p>Simple controls for your account and experience.</p>
      </header>
      <SettingsPanel />
      <section className="card">
        <h2>Account & preferences</h2>
        <div className="settings-links">
          <Link href="/onboarding">
            <span>
              <strong>Your profile and plan</strong>
              <small>
                Name, units, nutrition, water, workout target, budget, and food
                preferences
              </small>
            </span>
            <ArrowUpRight size={17} />
          </Link>
          <Link href="/forgot-password">
            <span>
              <strong>Reset password</strong>
              <small>Send a secure reset link to your email</small>
            </span>
            <ArrowUpRight size={17} />
          </Link>
          <a href="/api/export">
            <span>
              <strong>Export my data</strong>
              <small>Download your CalTrack records as JSON</small>
            </span>
            <Download size={17} />
          </a>
        </div>
      </section>
      <section className="card">
        <h2>Your privacy matters</h2>
        <p className="muted fine-print" style={{ marginTop: 13 }}>
          Your goals and records are private to your account. Reminder delivery,
          progress photos, and sharing are not enabled in this phase.
        </p>
        <form action={logout} style={{ marginTop: 22 }}>
          <button className="button">
            <LogOut size={14} /> Log out
          </button>
        </form>
      </section>
    </div>
  );
}
