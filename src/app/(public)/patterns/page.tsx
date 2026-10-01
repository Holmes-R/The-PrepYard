import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section-placeholder";
export const metadata: Metadata = { title: "Patterns" };
export default function Page() {
  return (
    <SectionPlaceholder
      title="Patterns"
      description="Build understanding, one pattern at a time."
      detail="Curated pattern groups will connect related questions without duplicating your progress."
    />
  );
}
