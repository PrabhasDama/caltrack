import { getStoresData } from "@/lib/services/stores";
import { StoreWorkspace } from "@/components/stores/store-workspace";
export const metadata = { title: "Nearby stores" };
export default async function Stores() {
  return (
    <StoreWorkspace
      data={await getStoresData()}
      mapKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
      mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID"}
      configured={
        !!(process.env.KROGER_CLIENT_ID && process.env.KROGER_CLIENT_SECRET)
      }
      environment={
        process.env.KROGER_ENVIRONMENT === "production"
          ? "production"
          : "certification"
      }
    />
  );
}
