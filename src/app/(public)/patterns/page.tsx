import { redirect } from "next/navigation";
import { patternHref } from "@/features/patterns/navigation.mjs";
import type { Metadata } from "next";
import { patternFilters } from "@/features/patterns/queries.mjs";
import { ClientPatterns } from "@/components/client/workspace-pages";
export const metadata: Metadata = { title: "DSA topics & patterns" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = patternFilters(await searchParams);
  if (filters.pattern) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value && key !== "pattern") params.set(key, String(value));
    redirect(patternHref(filters.pattern, params));
  }
  return <ClientPatterns filters={filters} />;
}
