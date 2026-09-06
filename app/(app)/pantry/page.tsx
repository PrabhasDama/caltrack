import { getInventory } from "@/lib/services/inventory";
import { PantryWorkspace } from "@/components/pantry/pantry-workspace";
export const metadata = { title: "Your pantry" };
export default async function Pantry() {
  const data = await getInventory();
  return (
    <PantryWorkspace
      units={data.units}
      foods={data.foods}
      pantry={data.pantry}
      today={data.today}
    />
  );
}
