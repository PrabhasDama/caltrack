import { getUploads } from "@/lib/services/uploads";
import { LabelScanner } from "@/components/scanning/label-scanner";
export const metadata = { title: "Review a nutrition label" };
export default async function Label() {
  return <LabelScanner {...await getUploads("nutrition-labels")} />;
}
