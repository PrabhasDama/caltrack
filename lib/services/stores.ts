import "server-only";
import { requireProfile } from "./auth";
export async function getStoresData() {
  const { client, user, profile } = await requireProfile();
  const [locations, preferences, settings, foods, userPrefs] =
    await Promise.all([
      client
        .from("store_locations")
        .select("*")
        .eq("is_demo", false)
        .order("name")
        .limit(200),
      client.from("location_preferences").select("*").eq("user_id", user.id),
      client
        .from("location_search_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      client.from("foods").select("id,name").order("name"),
      client
        .from("user_preferences")
        .select("zip_code")
        .eq("user_id", user.id)
        .single(),
    ]);
  if (
    locations.error ||
    preferences.error ||
    settings.error ||
    foods.error ||
    userPrefs.error
  )
    throw Error("Your store preferences could not be loaded.");
  return {
    locations: locations.data,
    preferences: preferences.data,
    settings: settings.data || {
      postal_code: userPrefs.data.zip_code,
      radius_miles: 10,
      share_prices: false,
    },
    foods: foods.data,
    units: profile.units as "metric" | "imperial",
  };
}
