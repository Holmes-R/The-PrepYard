const columns =
  "username, enabled, binding_version, created_at as sync_started_at, last_attempt_at, last_synced_at, last_error, last_matched_count, last_history_at, history_total, history_matched_count";

export async function syncSettings(client) {
  return (
    (
      await client.query(
        `select ${columns} from public.leetcode_sync_settings where user_id=private.student_id()`,
      )
    ).rows[0] ?? null
  );
}

export async function connectProfile(client, username) {
  const previous = (
    await client.query(
      "select username from public.leetcode_sync_settings where user_id=private.student_id() for update",
    )
  ).rows[0];
  if (previous?.username.toLowerCase() === username.toLowerCase()) {
    await client.query(
      "update public.leetcode_sync_settings set enabled=true where user_id=private.student_id()",
    );
  } else {
    await client.query(
      "delete from public.leetcode_history_questions where user_id=private.student_id()",
    );
    await client.query(
      "delete from public.leetcode_sync_receipts where user_id=private.student_id()",
    );
    await client.query(
      "insert into public.leetcode_sync_settings(user_id,username,enabled) values(private.student_id(),$1,true) on conflict(user_id) do update set username=excluded.username,enabled=true,binding_version=gen_random_uuid(),created_at=now(),last_attempt_at=null,last_synced_at=null,last_error=null,last_matched_count=0,last_history_at=null,history_total=0,history_matched_count=0",
      [username],
    );
  }
  return syncSettings(client);
}

export async function disconnectProfile(client) {
  await client.query(
    "delete from public.leetcode_history_questions where user_id=private.student_id()",
  );
  await client.query(
    "delete from public.leetcode_sync_settings where user_id=private.student_id()",
  );
  await client.query(
    "delete from public.leetcode_sync_receipts where user_id=private.student_id()",
  );
}

export async function setSyncEnabled(client, enabled) {
  await client.query(
    "update public.leetcode_sync_settings set enabled=$1 where user_id=private.student_id()",
    [enabled],
  );
  return syncSettings(client);
}

export async function claimSync(client) {
  return (
    (
      await client.query(
        "update public.leetcode_sync_settings set last_attempt_at=now() where user_id=private.student_id() and enabled and (last_attempt_at is null or last_attempt_at < now()-interval '2 minutes') returning username,binding_version",
      )
    ).rows[0] ?? null
  );
}

export async function recordSyncError(client, bindingVersion, message) {
  await client.query(
    "update public.leetcode_sync_settings set last_error=$2 where user_id=private.student_id() and binding_version=$1",
    [bindingVersion, message],
  );
}

export async function applyAccepted(client, claim, submissions) {
  // Lock the connection row while writing: an in-flight old username must never
  // import after disconnect, pause, or an account change.
  const current = await client.query(
    "select user_id,created_at from public.leetcode_sync_settings where user_id=private.student_id() and binding_version=$1 and enabled for update",
    [claim.binding_version],
  );
  if (!current.rowCount) return { cancelled: true, matched: 0, changed: 0 };
  // Only new Accepted submissions after this profile was connected count.
  // Read the cutoff under the same lock as the binding so delayed requests
  // cannot import older solves after an account change. Resume keeps it intact.
  const startedAt = new Date(current.rows[0].created_at).getTime();
  const eligible = submissions.filter(
    (row) => new Date(row.submittedAt).getTime() > startedAt,
  );
  const urls = eligible.flatMap((row) => [
    "https://leetcode.com/problems/" + row.slug + "/",
    "https://leetcode.com/problems/" + row.slug,
  ]);
  const questions = (
    await client.query(
      "select q.id,q.canonical_url from public.questions q join public.platforms p on p.id=q.platform_id where p.slug='leetcode' and q.is_listed and q.canonical_url=any($1::text[])",
      [urls],
    )
  ).rows;
  const bySlug = new Map(
    questions.map((q) => [
      new URL(q.canonical_url).pathname.split("/")[2],
      q.id,
    ]),
  );
  const matched = eligible.filter((row) => bySlug.has(row.slug));
  const uniqueQuestions = new Set(matched.map((row) => bySlug.get(row.slug)));
  let changed = 0;
  if (matched.length) {
    const added = (
      await client.query(
        "insert into public.leetcode_sync_receipts(user_id,submission_id,question_id,submitted_at) select private.student_id(),submission_id,question_id,submitted_at from unnest($1::text[],$2::uuid[],$3::timestamptz[]) as imported(submission_id,question_id,submitted_at) on conflict(user_id,submission_id) do nothing returning question_id,submitted_at",
        [
          matched.map((row) => row.id),
          matched.map((row) => bySlug.get(row.slug)),
          matched.map((row) => row.submittedAt),
        ],
      )
    ).rows;
    const historyRows = (
      await client.query(
        "select question_id,imported_at from public.leetcode_history_questions where user_id=private.student_id() and question_id=any($1::uuid[])",
        [added.map((row) => row.question_id)],
      )
    ).rows;
    const historical = new Map(
      historyRows.map((row) => [
        row.question_id,
        new Date(row.imported_at).getTime(),
      ]),
    );
    // Old public submissions already represented by the complete import should
    // not undo a later manual uncheck; a new Accepted re-solve still can.
    const newQuestions = [
      ...new Set(
        added
          .filter(
            (row) =>
              !historical.has(row.question_id) ||
              new Date(row.submitted_at).getTime() >
                historical.get(row.question_id),
          )
          .map((row) => row.question_id),
      ),
    ];
    if (newQuestions.length)
      changed = (
        await client.query(
          "insert into public.user_question_state(user_id,question_id,status) select private.student_id(),id,'solved' from unnest($1::uuid[]) as imported(id) on conflict(user_id,question_id) do update set status='solved' where public.user_question_state.status <> 'solved'",
          [newQuestions],
        )
      ).rowCount;
  }
  await client.query(
    "update public.leetcode_sync_settings set last_synced_at=now(),last_error=null,last_matched_count=$2 where user_id=private.student_id() and binding_version=$1",
    [claim.binding_version, uniqueQuestions.size],
  );
  return { cancelled: false, matched: uniqueQuestions.size, changed };
}
