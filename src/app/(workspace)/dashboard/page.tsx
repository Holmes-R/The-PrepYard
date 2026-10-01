import type { Metadata } from "next";
import { SectionPlaceholder } from "@/components/section-placeholder";
export const metadata: Metadata = { title: "My dashboard" };
export default function Page() {
  return (
    <SectionPlaceholder
      title="My dashboard"
      description="Make room for steady progress."
      detail="Guest progress, bookmarks, and a revision queue are planned. Nothing is saved yet."
    />
  );
}
