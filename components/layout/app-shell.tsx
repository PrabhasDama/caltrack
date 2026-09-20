"use client";
import { optimizerCache } from "@/lib/optimization/cache";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Utensils,
  ShoppingBasket,
  ChartNoAxesCombined,
  Ellipsis,
  PackageOpen,
  Settings2,
  LogOut,
  ArrowUpRight,
  Leaf,
  Wallet,
  MapPin,
} from "lucide-react";
import { logout } from "@/app/auth/actions";
const navigation = [
  { href: "/dashboard", name: "Today", icon: CalendarDays },
  { href: "/plan", name: "Plan", icon: Utensils },
  { href: "/groceries", name: "Groceries", icon: ShoppingBasket },
  { href: "/pantry", name: "Pantry", icon: PackageOpen },
  { href: "/budget", name: "Budget", icon: Wallet },
  { href: "/stores", name: "Stores", icon: MapPin },
  { href: "/progress", name: "Progress", icon: ChartNoAxesCombined },
  { href: "/more", name: "More", icon: Ellipsis },
];
export function AppShell({
  children,
  name,
}: {
  children: React.ReactNode;
  name: string;
}) {
  const path = usePathname();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">c</span>caltrack.
        </Link>
        <span className="sidebar-label">YOUR DAILY RHYTHM</span>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ href, name, icon: Icon }) =>
            href ? (
              <Link
                key={name}
                href={href}
                className={path === href ? "active" : ""}
                aria-current={path === href ? "page" : undefined}
              >
                <Icon size={18} />
                <span>{name}</span>
                {path === href && <i />}
              </Link>
            ) : (
              <span className="nav-future" key={name} aria-disabled="true">
                <Icon size={18} />
                <span>{name}</span>
                <small>Later</small>
              </span>
            ),
          )}
        </nav>
        <div className="sidebar-note">
          <Leaf size={22} />
          <h3>
            Small steps.
            <br />
            Lasting change.
          </h3>
          <p>
            Consistency is the goal.
            <br />
            Today is a good place to start.
          </p>
        </div>
        <div className="sidebar-bottom">
          <Link href="/settings" className="settings-link">
            <Settings2 size={17} /> Settings
          </Link>
          <div className="account-row">
            <Link href="/profile" className="avatar" aria-label="Your profile">
              {name.slice(0, 1).toUpperCase() || "C"}
            </Link>
            <Link href="/profile">
              <strong>{name}</strong>
              <span>
                Your personal space <ArrowUpRight size={10} />
              </span>
            </Link>
            <form action={logout} onSubmit={() => optimizerCache.clear()}>
              <button aria-label="Log out" title="Log out">
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="app-topbar">
          <span>YOUR WELLBEING, CONNECTED</span>
          <span className="topbar-right">
            <i /> A little better, every day{" "}
            <Link className="avatar mobile-avatar" href="/profile">
              {name.slice(0, 1)}
            </Link>
          </span>
        </header>
        <main id="main" className="app-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>Progress is a practice. Keep showing up.</span>
          <span>caltrack.</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation
          .filter((n) => !["Pantry", "Budget", "Stores"].includes(n.name))
          .map(({ href, name, icon: Icon }) =>
            href ? (
              <Link
                key={name}
                href={href}
                className={path === href ? "active" : ""}
                aria-current={path === href ? "page" : undefined}
              >
                <Icon size={20} />
                <span>{name}</span>
              </Link>
            ) : (
              <span key={name} aria-disabled="true" className="nav-future">
                <Icon size={20} />
                <span>{name}</span>
              </span>
            ),
          )}
      </nav>
    </div>
  );
}
