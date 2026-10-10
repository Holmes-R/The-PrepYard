import type { Metadata } from "next";
import { LeetCodeSyncSettings } from "@/components/integrations/leetcode-sync-settings";
import "./settings.css";
export const metadata: Metadata = { title: "LeetCode sync" };
export default function Page() {
  return <LeetCodeSyncSettings />;
}
