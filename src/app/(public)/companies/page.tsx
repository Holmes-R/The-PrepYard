import type { Metadata } from "next";
import { listCompanies } from "@/features/catalogue/server";
import { filtersFrom } from "@/features/catalogue/queries.mjs";
import { CompanyDirectory } from "@/components/questions/company-sheet";
export const metadata: Metadata = { title: "Company questions" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const open = typeof params.open === "string" ? params.open : null;
  const find = typeof params.find === "string" ? params.find : "";
  return (
    <CompanyDirectory
      companies={await listCompanies()}
      initialOpen={open}
      initialFilters={filtersFrom(params)}
      initialFind={find}
    />
  );
}
