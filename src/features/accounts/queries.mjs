import { practiceQuestionsSql } from "../questions/practice.mjs";
import { normalizeGfgUsername, MAX_SOLVED_QUESTIONS } from "./public-api.mjs";
const columns =
  "username,enabled,binding_version,created_at as sync_started_at,last_attempt_at,last_synced_at,last_error,last_matched_count";
export async function accountSettings(client) {
  return (
    (
      await client.query(
        `select ${columns} from public.account_sync_settings where user_id=private.student_id() and provider='gfg'`,
      )
    ).rows[0] ?? null
  );
}
function validSnapshot(snapshot) {
  if (
    !normalizeGfgUsername(snapshot?.username) ||
    !Array.isArray(snapshot.slugs) ||
    snapshot.slugs.length > MAX_SOLVED_QUESTIONS ||
    new Set(snapshot.slugs).size !== snapshot.slugs.length ||
    snapshot.slugs.some(
      (slug) =>
        typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,199}$/.test(slug),
    )
  )
    throw new Error("Invalid solved-question snapshot");
}
export async function connectAccount(client, snapshot) {
  validSnapshot(snapshot);
  const previous = (
    await client.query(
      "select username from public.account_sync_settings where user_id=private.student_id() and provider='gfg' for update",
    )
  ).rows[0];
  if (previous?.username.toLowerCase() === snapshot.username.toLowerCase()) {
    await client.query(
      "update public.account_sync_settings set enabled=true where user_id=private.student_id() and provider='gfg'",
    );
  } else {
    await client.query(
      "delete from public.account_sync_settings where user_id=private.student_id() and provider='gfg'",
    );
    await client.query(
      "insert into public.account_sync_settings(user_id,provider,username,last_attempt_at,last_synced_at) values(private.student_id(),'gfg',$1,now(),now())",
      [snapshot.username],
    );
    await client.query(
      "insert into public.account_sync_seen(user_id,provider,problem_key) select private.student_id(),'gfg',slug from unnest($1::text[]) as baseline(slug)",
      [snapshot.slugs],
    );
  }
  return accountSettings(client);
}
export async function disconnectAccount(client) {
  await client.query(
    "delete from public.account_sync_settings where user_id=private.student_id() and provider='gfg'",
  );
}
export async function setAccountEnabled(client, enabled) {
  await client.query(
    "update public.account_sync_settings set enabled=$1 where user_id=private.student_id() and provider='gfg'",
    [enabled],
  );
  return accountSettings(client);
}
export async function claimAccountSync(client) {
  return (
    (
      await client.query(
        "update public.account_sync_settings set last_attempt_at=now() where user_id=private.student_id() and provider='gfg' and enabled and (last_attempt_at is null or last_attempt_at < now()-interval '2 minutes') returning username,binding_version",
      )
    ).rows[0] ?? null
  );
}
export async function recordAccountError(client, bindingVersion, message) {
  await client.query(
    "update public.account_sync_settings set last_error=$2 where user_id=private.student_id() and provider='gfg' and binding_version=$1",
    [bindingVersion, message.slice(0, 200)],
  );
}
export async function applySolvedSnapshot(client, claim, snapshot) {
  validSnapshot(snapshot);
  if (snapshot.username.toLowerCase() !== claim.username.toLowerCase())
    throw new Error("Snapshot account mismatch");
  const current = await client.query(
    "select username from public.account_sync_settings where user_id=private.student_id() and provider='gfg' and binding_version=$1 and enabled for update",
    [claim.binding_version],
  );
  if (!current.rowCount) return { cancelled: true, matched: 0, changed: 0 };
  const added = (
    await client.query(
      "insert into public.account_sync_seen(user_id,provider,problem_key) select private.student_id(),'gfg',slug from unnest($1::text[]) as incoming(slug) on conflict(user_id,provider,problem_key) do nothing returning problem_key",
      [snapshot.slugs],
    )
  ).rows;
  const urls = added.map(
    (row) => "https://www.geeksforgeeks.org/problems/" + row.problem_key + "/1",
  );
  const questions = urls.length
    ? (
        await client.query(
          `select q.id from ${practiceQuestionsSql} q where q.is_listed and rtrim(q.canonical_url,'/')=any($1::text[])`,
          [urls],
        )
      ).rows
    : [];
  const ids = [...new Set(questions.map((q) => q.id))];
  const changed = ids.length
    ? (
        await client.query(
          "insert into public.user_question_state(user_id,question_id,status) select private.student_id(),id,'solved' from unnest($1::uuid[]) as imported(id) on conflict(user_id,question_id) do update set status='solved' where public.user_question_state.status <> 'solved'",
          [ids],
        )
      ).rowCount
    : 0;
  await client.query(
    "update public.account_sync_settings set last_synced_at=now(),last_error=null,last_matched_count=$2 where user_id=private.student_id() and provider='gfg' and binding_version=$1",
    [claim.binding_version, ids.length],
  );
  return { cancelled: false, matched: ids.length, changed };
}
