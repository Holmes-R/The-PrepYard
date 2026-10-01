import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section-placeholder";
export const metadata: Metadata = { title: "Explore" };
export default function Page() {
  return (
    <SectionPlaceholder
      title="Explore"
      description="One place to find coding practice across platforms."
      detail="Search, platform filters, difficulty, and company tags will arrive with the catalogue milestone."
    />
  );
}
