import type { Metadata } from "next";
import { listCompanies } from "@/features/catalogue/server";
import { CompanyDirectory } from "@/components/questions/company-sheet";
export const metadata: Metadata = { title: "Company questions" };
export default async function Page() {
  return <CompanyDirectory companies={await listCompanies()} />;
}
