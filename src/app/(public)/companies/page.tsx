import type { Metadata } from "next";
import { filtersFrom } from "@/features/catalogue/queries.mjs";
import { ClientCompanies } from "@/components/client/workspace-pages";
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
    <ClientCompanies open={open} find={find} filters={filtersFrom(params)} />
  );
}
