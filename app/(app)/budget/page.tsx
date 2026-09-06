import Link from "next/link";
import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBudget } from "@/lib/services/budget";
import { budgetSummary, budgetHealth } from "@/lib/budget/calculations";
import { money } from "@/lib/pricing/calculations";
import { BudgetEditor } from "@/components/budget/budget-editor";
import { PurchaseEditor } from "@/components/budget/purchase-editor";
import { PurchaseCard } from "@/components/budget/purchase-card";
export const metadata = { title: "Your grocery budget" };
export default async function Budget({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; page?: string }>;
}) {
  const query = await searchParams;
  const d = await getBudget(query.month, query.page);
  const currency = d.budget.currency;
  const current = d.history.find(
    (h) => h.month === d.month && h.currency === currency,
  );
  const numbers = budgetSummary(
    d.budget.monthly_amount,
    current?.total || 0,
    current?.shopping_days || 0,
    d.month,
    d.today,
  );
  const quality =
    d.demoHistory.find((h) => h.month === d.month && h.currency === currency)
      ?.demo_total || 0;
  const health = budgetHealth(
    d.budget.monthly_amount,
    numbers.spent,
    current?.shopping_days || 0,
    d.month,
    d.today,
  );
  const context = {
    foods: d.foods,
    shoppingFoodIds: d.shoppingFoodIds,
    recentFoodIds: [...new Set([...d.recentFoodIds, ...d.shoppingFoodIds])],
    units: d.units,
    products: d.products,
    stores: d.stores,
    today: d.today,
    currency,
  };
  return (
    <div className="secondary-page">
      <header className="dashboard-heading">
        <div className="page-title">
          <span className="eyebrow">GOOD FOOD. GROUNDED SPENDING.</span>
          <h1>
            Make every grocery dollar count<span className="brand-dot">.</span>
          </h1>
          <p>Your real receipts, a clear monthly target, and room to adjust.</p>
        </div>
        <PurchaseEditor {...context}>
          <Button>
            <Plus size={15} /> Log purchase
          </Button>
        </PurchaseEditor>
      </header>
      <section className="card budget-toolbar">
        <form>
          <label className="field">
            Viewing month
            <input
              type="month"
              name="month"
              defaultValue={d.month}
              required
              max={d.today.slice(0, 7)}
            />
          </label>
          <Button variant="outline">View month</Button>
        </form>
        <BudgetEditor amount={d.budget.monthly_amount} currency={currency} />
      </section>
      <div className="budget-metrics">
        <section className="card">
          <span className="eyebrow">MONTHLY TARGET</span>
          <strong>{money(d.budget.monthly_amount, currency)}</strong>
          <p className="muted">Your ongoing grocery budget</p>
        </section>
        <section className="card">
          <span className="eyebrow">SPENT · {d.month}</span>
          <strong data-testid="budget-spent">
            {money(numbers.spent, currency)}
          </strong>
          <p className="muted">
            {current?.purchase_count || 0} receipts in {currency}
          </p>
        </section>
        <section className="card">
          <span className="eyebrow">
            {numbers.remaining < 0 ? "OVER BUDGET" : "REMAINING"}
          </span>
          <strong>{money(Math.abs(numbers.remaining), currency)}</strong>
          <progress
            value={numbers.percent}
            max={100}
            aria-label="Monthly budget used"
          />
        </section>
      </div>
      <p className="notice">
        <strong>
          {health.status} · {health.percent.toFixed(0)}% used
        </strong>
        {health.weeklyAverage !== null &&
          ` · ${money(health.weeklyAverage, currency)} average per week · ${money(health.costPerDay!, currency)} per calendar day`}
      </p>
      {quality > 0 && (
        <p className="notice">
          Demo pricing: {money(quality, currency)} of this month’s total is
          simulated/estimated, pending correction from your receipts. Spending
          and projections include these estimates.
        </p>
      )}
      <p className="notice">
        {numbers.projected === null
          ? "A projection appears after at least 7 days and purchases on 2 different dates in the current month."
          : `At this month’s pace: about ${money(numbers.projected, currency)}. This simple estimate can shift after your next shop.`}{" "}
        Amounts in other currencies remain separate. No exchange rate is
        assumed.
      </p>
      <section className="card spending-history">
        <div className="section-heading">
          <div>
            <h2>Spending history</h2>
            <p className="muted">Up to 6 recent months · totals by currency</p>
          </div>
          <Wallet size={20} />
        </div>
        {d.history.length ? (
          <div className="history-rows">
            {d.history
              .filter((h) =>
                [...new Set(d.history.map((r) => r.month))]
                  .sort()
                  .reverse()
                  .slice(0, 6)
                  .includes(h.month),
              )
              .map((h) => (
                <div key={`${h.month}-${h.currency}`}>
                  <Link href={`/budget?month=${h.month}`}>
                    {h.month} · {h.currency}
                  </Link>
                  <span>{h.purchase_count} receipts</span>
                  <strong>{money(h.total, h.currency)}</strong>
                </div>
              ))}
          </div>
        ) : (
          <p className="muted">
            Your first purchase starts your spending history.
          </p>
        )}
      </section>
      <div className="section-heading">
        <div>
          <h2>Your purchases</h2>
          <p className="muted">
            {d.totalPurchases} receipts in {d.month} · all currencies
          </p>
        </div>
      </div>
      {d.purchases.length ? (
        <div className="purchase-list">
          {d.purchases.map((p) => (
            <PurchaseCard
              key={`${p.id}-${p.updated_at}`}
              purchase={p}
              context={context}
            />
          ))}
        </div>
      ) : (
        <section className="empty-meals">
          <div className="empty-icon">
            <Wallet size={24} />
          </div>
          <div>
            <h3>A little awareness goes a long way.</h3>
            <p>Log a grocery receipt to see where this month stands.</p>
          </div>
        </section>
      )}
      <div className="purchase-actions">
        {d.page > 1 && (
          <Link
            className="button"
            href={`/budget?month=${d.month}&page=${d.page - 1}`}
          >
            Previous receipts
          </Link>
        )}
        {d.page * 20 < d.totalPurchases && (
          <Link
            className="button"
            href={`/budget?month=${d.month}&page=${d.page + 1}`}
          >
            More receipts
          </Link>
        )}
      </div>
      <p className="fine-print muted">
        Spending uses the full receipt total. Nutrition-based costs use matched
        foods and known package weights; unmatched items have no invented
        nutrition metrics. Shopping-session purchases update pantry once. Manual
        historical receipts only update spending.
      </p>
    </div>
  );
}
