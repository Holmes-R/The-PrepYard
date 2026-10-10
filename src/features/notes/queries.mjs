// Called inside withStudentDatabase so all reads use the signed-in owner's policies.
export async function studentNotes(
  client,
  requestedPage = 1,
  requestedQuery = "",
) {
  const pageSize = 24;
  const parsed = Number(requestedPage);
  const requested = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
  const query =
    typeof requestedQuery === "string"
      ? requestedQuery.trim().slice(0, 200)
      : "";
  const base =
    "from public.notes n join public.questions q on q.id=n.question_id where n.user_id=private.student_id() and length(btrim(n.content))>0 and (strpos(lower(q.title),lower($1))>0 or strpos(lower(n.content),lower($1))>0)";
  const total = (
    await client.query("select count(*)::int total " + base, [query])
  ).rows[0].total;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requested, pages);
  const rows = (
    await client.query(
      "select q.id,q.title,q.canonical_url,n.content,n.updated_at " +
        base +
        " order by n.updated_at desc,q.id limit $2 offset $3",
      [query, pageSize, (page - 1) * pageSize],
    )
  ).rows;
  return { rows, total, page, pages };
}
