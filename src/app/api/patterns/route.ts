import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { patternFilters } from "@/features/patterns/queries.mjs";
import { getPatternQuestions } from "@/features/patterns/server";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  await requireUser();
  const filters = patternFilters(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!filters.topic)
    return NextResponse.json(
      { error: "Choose a topic." },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  try {
    return NextResponse.json(await getPatternQuestions(filters), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Questions could not be loaded. Please try again." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
