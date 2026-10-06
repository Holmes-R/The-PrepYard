import type { Metadata } from "next";
import { ControlShowcase } from "@/components/ui/control-showcase";
export const metadata: Metadata = { title: "Component preview" };
export default function ComponentsPage() {
  return <ControlShowcase />;
}
