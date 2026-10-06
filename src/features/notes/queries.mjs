// Called inside withStudentDatabase so all reads use the signed-in owner's policies.
export async function studentNotes(client, requestedPage = 1) {
  const pageSize = 24;
  const parsed = Number(requestedPage);
  const requested = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
  const base =
    "from public.notes n join public.questions q on q.id=n.question_id where n.user_id=private.student_id() and length(btrim(n.content))>0";
  const total = (await client.query("select count(*)::int total " + base))
    .rows[0].total;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requested, pages);
  const rows = (
    await client.query(
      "select q.id,q.title,q.canonical_url,n.content,n.updated_at " +
        base +
        " order by n.updated_at desc,q.id limit $1 offset $2",
      [pageSize, (page - 1) * pageSize],
    )
  ).rows;
  return { rows, total, page, pages };
}
