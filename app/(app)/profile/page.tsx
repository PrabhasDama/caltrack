import Link from "next/link";
import { ArrowUpRight, UserRound } from "lucide-react";
import { requireProfile } from "@/lib/services/auth";
import { formatWeight } from "@/lib/nutrition/units";
export const metadata = { title: "Your profile" };
export default async function Profile() {
  const { client, user, profile } = await requireProfile();
  const [{ data: prefs, error: pe }, { data: storePrefs, error: se }] =
    await Promise.all([
      client
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single(),
      client
        .from("store_preferences")
        .select("stores(name)")
        .eq("user_id", user.id),
    ]);
  if (pe || se) throw new Error("Could not load preferences");
  const stores = (storePrefs || [])
    .flatMap((s) => (Array.isArray(s.stores) ? s.stores : [s.stores]))
    .filter(Boolean);
  return (
    <div className="secondary-page">
      <header className="dashboard-heading">
        <div className="page-title">
          <span className="eyebrow">YOUR PERSONAL SPACE</span>
          <h1>
            Hello, {profile.first_name}
            <span className="brand-dot">.</span>
          </h1>
          <p>Your preferences shape your daily rhythm.</p>
        </div>
        <Link className="button" href="/preferences">
          Edit profile & plan <ArrowUpRight size={14} />
        </Link>
      </header>
      <section className="card">
        <div className="section-heading">
          <h2>
            <UserRound size={17} /> About you
          </h2>
          <span className="pill">Private</span>
        </div>
        <dl className="summary-list">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Starting weight</dt>
            <dd>{formatWeight(profile.starting_weight_kg, profile.units)}</dd>
          </div>
          <div>
            <dt>Height</dt>
            <dd>
              {profile.units === "imperial"
                ? `${(profile.height_cm / 2.54).toFixed(1)} in`
                : `${profile.height_cm} cm`}
            </dd>
          </div>
          <div>
            <dt>Age</dt>
            <dd>{profile.age}</dd>
          </div>
          <div>
            <dt>Time zone</dt>
            <dd>{profile.timezone}</dd>
          </div>
        </dl>
      </section>
      <div className="info-grid">
        <section className="card">
          <h2>At your table</h2>
          <dl className="summary-list">
            <div>
              <dt>Favorite proteins</dt>
              <dd>{prefs.preferred_proteins.join(", ") || "No preferences"}</dd>
            </div>
            <div>
              <dt>Favorite carbs</dt>
              <dd>{prefs.preferred_carbs.join(", ") || "No preferences"}</dd>
            </div>
            <div>
              <dt>Restrictions</dt>
              <dd>{prefs.restrictions.join(", ") || "None selected"}</dd>
            </div>
            <div>
              <dt>Excluded ingredients</dt>
              <dd>{prefs.excluded_foods.join(", ") || "None selected"}</dd>
            </div>
            <div>
              <dt>Disliked foods</dt>
              <dd>{prefs.disliked_foods.join(", ") || "None selected"}</dd>
            </div>
            <div>
              <dt>Cooking routine</dt>
              <dd>
                {prefs.cooking_minutes} min · {prefs.meals_per_day} meals / day
              </dd>
            </div>
          </dl>
        </section>
        <section className="card">
          <h2>At the store</h2>
          <dl className="summary-list">
            <div>
              <dt>ZIP code</dt>
              <dd>{prefs.zip_code}</dd>
            </div>
            <div>
              <dt>Stores</dt>
              <dd>{stores.map((s) => s.name).join(", ")}</dd>
            </div>
            <div>
              <dt>Shopping rhythm</dt>
              <dd>{String(prefs.shopping_frequency).replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Shopping preference</dt>
              <dd>
                {
                  (
                    {
                      cheapest: "Cheapest possible",
                      fewest: "Fewest stores",
                      balance: "Best balance",
                      closest: "Closest stores",
                    } as Record<string, string>
                  )[prefs.shopping_preference]
                }
              </dd>
            </div>
          </dl>
          <p className="fine-print muted" style={{ marginTop: 20 }}>
            Your preferences guide meal planning. CalTrack does not
            display live store prices in this phase.
          </p>
        </section>
      </div>
    </div>
  );
}
