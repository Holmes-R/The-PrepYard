import type { Metadata } from "next";
import { getPatternOverview } from "@/features/patterns/server";
import { patternFilters } from "@/features/patterns/queries.mjs";
import { PatternSheet } from "@/components/sheets/pattern-sheet";
export const metadata: Metadata = { title: "DSA topics & patterns" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = patternFilters(await searchParams);
  return (
    <PatternSheet
      key={JSON.stringify(filters)}
      overview={await getPatternOverview(filters)}
      filters={filters}
    />
  );
}
