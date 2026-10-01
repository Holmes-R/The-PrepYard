import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section-placeholder";
export const metadata: Metadata = { title: "Notes" };
export default function Page() {
  return (
    <SectionPlaceholder
      title="Notes"
      description="Keep the lessons behind each solution."
      detail="Private notes and backup export will be implemented with progress storage."
    />
  );
}
