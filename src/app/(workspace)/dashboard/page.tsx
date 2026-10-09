import type { Metadata } from "next";
import { ClientDashboard } from "@/components/client/dashboard";
import "./dashboard.css";
export const metadata: Metadata = { title: "My dashboard" };
export default function Page() {
  return <ClientDashboard />;
}
