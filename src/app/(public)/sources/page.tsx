import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section-placeholder";
export const metadata: Metadata = { title: "Data sources" };
export default function Page() {
  return (
    <SectionPlaceholder
      title="Data sources"
      description="Know where your practice data comes from."
      detail="Source credits, snapshot dates, and import history will appear here once the first importer is connected."
    />
  );
}
