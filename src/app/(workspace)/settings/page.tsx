import type { Metadata } from "next";
import { AccountSyncSettings } from "@/components/integrations/account-sync-settings";
import "./settings.css";
export const metadata: Metadata = { title: "Sync accounts" };
export default function Page() {
  return <AccountSyncSettings />;
}
