import { notFound } from "next/navigation";
import { filtersFrom } from "@/features/catalogue/queries.mjs";
import { ClientCompany } from "@/components/client/workspace-pages";
export const metadata = { title: "Company questions" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 200) notFound();
  return (
    <ClientCompany slug={slug} filters={filtersFrom(await searchParams)} />
  );
}
