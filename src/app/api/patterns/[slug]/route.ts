import { type NextRequest } from "next/server";
import { patternFilters } from "@/features/patterns/queries.mjs";
import { getPatternPractice } from "@/features/patterns/server";
import { privateJson } from "@/lib/http/private-json";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  return privateJson(async () => {
    const { slug } = await params;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120)
      return null;
    return getPatternPractice(
      slug,
      patternFilters({
        ...Object.fromEntries(request.nextUrl.searchParams),
        pattern: slug,
      }),
    );
  });
}
