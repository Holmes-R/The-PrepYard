import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section-placeholder";
export const metadata: Metadata = { title: "Companies" };
export default function Page() {
  return (
    <SectionPlaceholder
      title="Companies"
      description="Prepare for the companies on your list."
      detail="Company sheets will help you prioritize questions by frequency."
    />
  );
}
