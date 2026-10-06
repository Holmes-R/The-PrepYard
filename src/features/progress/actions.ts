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
// Confidence levels shown in the revision dialog, stored as-is in
// user_question_state.confidence (smallint 1-5; only 1-4 are offered).

export async function saveRevision(
  questionId: string,
  confidence: number,
): Promise<{ ok: boolean; message: string }> {
  if (!validStudentId(questionId))
    return { ok: false, message: "Invalid question." };
  if (!Number.isInteger(confidence) || confidence < 1 || confidence > 4)
    return { ok: false, message: "Choose a confidence level." };
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
      // One transaction: the rating, the reminder, and the history entry either
      // all land or none do. The owner policies keep the history private.
      await client.query(
        "insert into public.user_question_state(user_id,question_id,confidence,next_revision_at) values(private.student_id(),$1,$2,now()+interval '1 day') on conflict(user_id,question_id) do update set confidence=excluded.confidence,next_revision_at=excluded.next_revision_at",
        [questionId, confidence],
      );
      await client.query(
        "insert into public.practice_events(user_id,question_id,event_type,confidence) values(private.student_id(),$1,'reviewed',$2)",
        [questionId, confidence],
      );
    });
    revalidatePath("/companies", "layout");
    revalidatePath("/patterns", "layout");
    return { ok: true, message: "Revision saved" };
  } catch {
    return { ok: false, message: "Could not save. Please try again." };
  }
}
export async function getRevisionHistory(questionId: string): Promise<{
  ok: boolean;
  message: string;
  entries: { id: string; occurred_at: string; confidence: number | null }[];
}> {
  if (!validStudentId(questionId))
    return { ok: false, message: "Invalid question.", entries: [] };
  try {
    const entries = await withStudentDatabase(async (client) => {
      // Owner policy scopes this to the caller's own events; a missing question
      // simply yields no rows rather than an error.
      const { rows } = await client.query(
        "select e.id,e.occurred_at,e.confidence from public.practice_events e where e.question_id=$1 and e.user_id=private.student_id() and e.event_type='reviewed' order by e.occurred_at desc,e.id desc limit 20",
        [questionId],
      );
      return rows;
    });
    // Server actions must return serializable data; pg gives Date objects.
    return {
      ok: true,
      message: "",
      entries: entries.map(
        (row: {
          id: string;
          occurred_at: Date;
          confidence: number | null;
        }) => ({
          id: row.id,
          occurred_at: row.occurred_at.toISOString(),
          confidence: row.confidence,
        }),
      ),
    };
  } catch {
    return { ok: false, message: "Could not load history.", entries: [] };
  }
}
