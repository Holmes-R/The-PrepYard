import { LeetCodeSyncError } from "./public-api.mjs";

export async function applyHistory(client, history) {
  const connection = (
    await client.query(
      "select username,enabled,last_history_at from public.leetcode_sync_settings where user_id=private.student_id() and binding_version=$1 for update",
      [history.bindingVersion],
    )
  ).rows[0];
  if (
    !connection ||
    connection.username.toLowerCase() !== history.username.toLowerCase()
  )
    throw new LeetCodeSyncError(
      "Your PrepYard account or linked username changed. Reconnect the extension.",
      409,
    );
  if (!connection.enabled)
    return {
      ok: true,
      skipped: true,
      changed: 0,
      message: "Syncing is paused in PrepYard.",
    };
  if (
    connection.last_history_at &&
    Date.now() - new Date(connection.last_history_at).getTime() < 120_000
  )
    return {
      ok: true,
      skipped: true,
      changed: 0,
      message:
        "Full history was checked recently. The next check runs in two minutes.",
    };

  // Keep unmatched slugs too: a later catalogue addition can be completed on
  // the next import. A matched receipt makes manual unchecking durable.
  await client.query(
    "insert into public.leetcode_history_questions(user_id,slug) select private.student_id(),slug from unnest($1::text[]) as solved(slug) on conflict(user_id,slug) do nothing",
    [history.slugs],
  );
  const added = (
    await client.query(`
    update public.leetcode_history_questions h set question_id=q.id
    from public.questions q join public.platforms p on p.id=q.platform_id
    where h.user_id=private.student_id() and h.question_id is null and q.is_listed
      and p.slug='leetcode' and (q.canonical_url='https://leetcode.com/problems/'||h.slug||'/'
        or q.canonical_url='https://leetcode.com/problems/'||h.slug)
    returning h.question_id`)
  ).rows;
  let changed = 0;
  if (added.length)
    changed = (
      await client.query(
        "insert into public.user_question_state(user_id,question_id,status) select private.student_id(),id,'solved' from unnest($1::uuid[]) as imported(id) on conflict(user_id,question_id) do update set status='solved' where public.user_question_state.status<>'solved'",
        [[...new Set(added.map((row) => row.question_id))]],
      )
    ).rowCount;
  const matched = Number(
    (
      await client.query(
        "select count(*) as n from public.leetcode_history_questions where user_id=private.student_id() and question_id is not null and slug=any($1::text[])",
        [history.slugs],
      )
    ).rows[0].n,
  );
  await client.query(
    "update public.leetcode_sync_settings set last_history_at=now(),history_total=$2,history_matched_count=$3 where user_id=private.student_id() and binding_version=$1",
    [history.bindingVersion, history.total, matched],
  );
  return {
    ok: true,
    skipped: false,
    total: history.total,
    matched,
    changed,
    message: `Full history imported: ${history.total} solved questions, ${matched} matched in PrepYard, ${changed} newly completed.`,
  };
}
