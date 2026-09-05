import { getPlanContext } from "@/lib/services/meal-plan";
import { PlanWorkspace } from "@/components/plan/plan-workspace";
export const metadata = { title: "Your meal plan" };
export default async function Plan() {
  const context = await getPlanContext();
  return <PlanWorkspace key={context.revision} context={context} />;
}
