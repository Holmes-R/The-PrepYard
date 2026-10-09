import { notFound, redirect } from "next/navigation";
import { patternFilters } from "@/features/patterns/queries.mjs";
import { patternHref } from "@/features/patterns/navigation.mjs";
import { ClientPattern } from "@/components/client/workspace-pages";
export const metadata = { title: "Pattern practice" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120) notFound();
  const filters = patternFilters({ ...(await searchParams), pattern: slug });
  if (filters.pattern !== slug) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value && key !== "pattern") query.set(key, String(value));
    redirect(patternHref(filters.pattern, query));
  }
  return <ClientPattern slug={slug} filters={filters} />;
}
