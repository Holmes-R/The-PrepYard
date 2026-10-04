"use server";
import { revalidatePath } from "next/cache";
import { withStudentDatabase } from "@/lib/database/server";
import { validStudentId } from "@/lib/auth/policy.mjs";
export async function saveQuestionProgress(
  questionId: string,
  kind: "solved" | "bookmark" | "revision" | "note",
  value: boolean | string,
): Promise<{ ok: boolean; message: string }> {
  if (!validStudentId(questionId))
    return { ok: false, message: "Invalid question." };
  if (!["solved", "bookmark", "revision", "note"].includes(kind))
    return { ok: false, message: "Invalid action." };
  if (
    kind === "note"
      ? typeof value !== "string" || value.length > 50000
      : typeof value !== "boolean"
  )
    return { ok: false, message: "Invalid value." };
  try {
    await withStudentDatabase(async (client) => {
      if (
        !(
          await client.query("select id from public.questions where id=$1", [
            questionId,
          ])
        ).rowCount
      )
        throw new Error("Unavailable question");
      if (kind === "note") {
        const content = String(value).trim();
        if (!content)
          await client.query(
            "delete from public.notes where user_id=private.student_id() and question_id=$1",
            [questionId],
          );
        else
          await client.query(
            "insert into public.notes(user_id,question_id,content) values(private.student_id(),$1,$2) on conflict(user_id,question_id) do update set content=excluded.content",
            [questionId, content],
          );
      } else if (kind === "solved")
        await client.query(
          "insert into public.user_question_state(user_id,question_id,status) values(private.student_id(),$1,$2) on conflict(user_id,question_id) do update set status=excluded.status",
          [questionId, value ? "solved" : "not_started"],
        );
      else if (kind === "bookmark")
        await client.query(
          "insert into public.user_question_state(user_id,question_id,bookmarked) values(private.student_id(),$1,$2) on conflict(user_id,question_id) do update set bookmarked=excluded.bookmarked",
          [questionId, value],
        );
      else
        await client.query(
          "insert into public.user_question_state(user_id,question_id,next_revision_at) values(private.student_id(),$1,case when $2::boolean then now()+interval '1 day' else null end) on conflict(user_id,question_id) do update set next_revision_at=excluded.next_revision_at",
          [questionId, value],
        );
    });
    revalidatePath("/companies", "layout");
    revalidatePath("/patterns", "layout");
    return { ok: true, message: "Saved" };
  } catch {
    return { ok: false, message: "Could not save. Please try again." };
  }
}
