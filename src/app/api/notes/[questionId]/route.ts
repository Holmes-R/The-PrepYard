import { currentUser } from "@/lib/auth/server";
import { getQuestionNote } from "@/features/catalogue/server";
const headers = { "Cache-Control": "private, no-store" };
// One private note, fetched when its editor opens. The list queries only carry
// whether a note exists, because full content is up to 50KB per row.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  if (!(await currentUser()))
    return Response.json(
      { error: "Log in required" },
      { status: 401, headers },
    );
  const { questionId } = await params;
  try {
    return Response.json(
      { note: await getQuestionNote(questionId) },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Note is temporarily unavailable" },
      { status: 503, headers },
    );
  }
}
