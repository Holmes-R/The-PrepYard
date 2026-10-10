import { type NextRequest } from "next/server";
import { studentNotes } from "@/features/notes/queries.mjs";
import { withStudentDatabase } from "@/lib/database/server";
import { privateJson } from "@/lib/http/private-json";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  return privateJson(() =>
    withStudentDatabase((client) =>
      studentNotes(
        client,
        request.nextUrl.searchParams.get("page") ?? undefined,
        request.nextUrl.searchParams.get("q") ?? undefined,
      ),
    ),
  );
}
