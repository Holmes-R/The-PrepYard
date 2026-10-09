import { type NextRequest } from "next/server";
import { currentUser, withAuthRequest } from "@/lib/auth/server";
import { getCompanySheet } from "@/features/catalogue/server";
import { filtersFrom } from "@/features/catalogue/queries.mjs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  return withAuthRequest(async () => {
    if (!(await currentUser()))
      return Response.json(
        { error: "Log in required" },
        { status: 401, headers },
      );
    const { slug } = await params;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 200)
      return Response.json(
        { error: "Company not found" },
        { status: 404, headers },
      );
    try {
      const query = request.nextUrl.searchParams;
      const sheet = await getCompanySheet(
        slug,
        filtersFrom({
          ...Object.fromEntries(query),
          // Object.fromEntries keeps only the last of a repeated key, which would
          // silently drop every topic but one.
          topics: query.getAll("topics"),
        }),
      );
      return sheet
        ? Response.json(sheet, { headers })
        : Response.json(
            { error: "Company not found" },
            { status: 404, headers },
          );
    } catch {
      return Response.json(
        { error: "Questions are temporarily unavailable" },
        { status: 503, headers },
      );
    }
  });
}
