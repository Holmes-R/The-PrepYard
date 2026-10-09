import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { roadmapChoices } from "@/features/patterns/roadmap.mjs";
import "./landing.css";
export const metadata: Metadata = {
  title: "Free coding interview preparation",
  description:
    "Prepare for coding interviews with company questions, DSA topics, learning patterns, private notes and revision tracking. Free with a PrepYard account.",
};
export default function Page() {
  return <LandingPage patternCount={roadmapChoices.length} />;
}
