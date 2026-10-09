import { type NextRequest } from "next/server";
import { patternFilters } from "@/features/patterns/queries.mjs";
import { getPatternOverview } from "@/features/patterns/server";
import { privateJson } from "@/lib/http/private-json";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return privateJson(() =>
    getPatternOverview(
      patternFilters(Object.fromEntries(request.nextUrl.searchParams)),
    ),
  );
}
