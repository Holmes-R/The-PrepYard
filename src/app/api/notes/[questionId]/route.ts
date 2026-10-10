import { currentUser } from "@/lib/auth/server";
import { withStudentDatabase } from "@/lib/database/server";
import { validStudentId } from "@/lib/auth/policy.mjs";
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
      await withStudentDatabase(async (client) => {
        if (!validStudentId(questionId)) return { note: "", tags: [] };
        const row = (
          await client.query(
            "select n.content as note,n.tags from public.notes n join public.questions q on q.id=n.question_id where n.user_id=private.student_id() and q.id=$1 and q.is_listed",
            [questionId],
          )
        ).rows[0];
        return row ?? { note: "", tags: [] };
      }),
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Note is temporarily unavailable" },
      { status: 503, headers },
    );
  }
}
