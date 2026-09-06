import { getUploads } from "@/lib/services/uploads";
import { PhotoWorkspace } from "@/components/progress/photo-workspace";
export const metadata = { title: "Private progress photos" };
export default async function Photos() {
  return <PhotoWorkspace {...await getUploads("progress-photos")} />;
}
