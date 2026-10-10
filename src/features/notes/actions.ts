"use server";
import { revalidatePath } from "next/cache";
import { withStudentDatabase } from "@/lib/database/server";
import { validStudentId } from "@/lib/auth/policy.mjs";
import { parseNoteInput } from "./model.mjs";

export async function saveNote(
  questionId: string,
  content: string,
  tags: string[],
) {
  if (!validStudentId(questionId))
    return { ok: false, message: "Invalid question." };
  let note;
  try {
    note = parseNoteInput(content, tags);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid note.",
    };
  }
  try {
    await withStudentDatabase(async (client) => {
      if (
        !(
          await client.query(
            "select id from public.questions where id=$1 and is_listed",
            [questionId],
          )
        ).rowCount
      )
        throw new Error("Unavailable question");
      if (!note.content)
        await client.query(
          "delete from public.notes where user_id=private.student_id() and question_id=$1",
          [questionId],
        );
      else
        await client.query(
          "insert into public.notes(user_id,question_id,content,tags) values(private.student_id(),$1,$2,$3::text[]) on conflict(user_id,question_id) do update set content=excluded.content,tags=excluded.tags",
          [questionId, note.content, note.tags],
        );
    });
    revalidatePath("/notes");
    revalidatePath("/companies", "layout");
    revalidatePath("/patterns", "layout");
    return { ok: true, message: "Saved" };
  } catch {
    return { ok: false, message: "Could not save. Please try again." };
  }
}
