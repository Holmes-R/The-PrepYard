begin;
create function pg_temp.sync_assert(value boolean, label text) returns void
language plpgsql as $$ begin if not coalesce(value, false) then raise exception 'LeetCode sync assertion: %', label; end if; end $$;
create function pg_temp.sync_denied(statement text) returns void
language plpgsql as $$ begin execute statement; raise exception 'Expected permission denial'; exception when insufficient_privilege then null; end $$;

select set_config('test.sync_a', gen_random_uuid()::text, true);
select set_config('test.sync_b', gen_random_uuid()::text, true);
select set_config('test.sync_question', gen_random_uuid()::text, true);
select set_config('test.sync_platform', gen_random_uuid()::text, true);
insert into private.students(id, name) values(current_setting('test.sync_a')::uuid, 'Sync A'), (current_setting('test.sync_b')::uuid, 'Sync B');
insert into public.platforms(id, slug, name, base_url) values(current_setting('test.sync_platform')::uuid, 'sync-contract-test', 'Sync contract test', 'https://example.test');
insert into public.questions(id, platform_id, canonical_url, title) values(current_setting('test.sync_question')::uuid, current_setting('test.sync_platform')::uuid, 'https://example.test/sync-contract', 'Sync contract fixture');

select pg_temp.sync_assert((select relrowsecurity from pg_class where oid='public.leetcode_sync_settings'::regclass), 'settings RLS enabled');
select pg_temp.sync_assert((select relrowsecurity from pg_class where oid='public.leetcode_sync_receipts'::regclass), 'receipts RLS enabled');
set local role anon;
select pg_temp.sync_denied('select * from public.leetcode_sync_settings');
select pg_temp.sync_denied('select * from public.leetcode_sync_receipts');
reset role;

set local role authenticated;
select set_config('prepyard.student_id', current_setting('test.sync_a'), true);
insert into public.leetcode_sync_settings(user_id, username) values(private.student_id(), 'fixture_student');
insert into public.leetcode_sync_receipts(user_id, submission_id, question_id, submitted_at) values(private.student_id(), '123456789', current_setting('test.sync_question')::uuid, now());
select pg_temp.sync_assert((select count(*)=1 from public.leetcode_sync_settings), 'owner sees settings');
select pg_temp.sync_assert((select count(*)=1 from public.leetcode_sync_receipts), 'owner sees receipt');
select pg_temp.sync_denied('update public.leetcode_sync_settings set user_id=current_setting(''test.sync_b'')::uuid');
select pg_temp.sync_denied('update public.leetcode_sync_receipts set submission_id=''222''');

with claimed as (
  update public.leetcode_sync_settings set last_attempt_at=now()
  where user_id=private.student_id() and enabled and (last_attempt_at is null or last_attempt_at < now()-interval '2 minutes') returning user_id
) select pg_temp.sync_assert((select count(*)=1 from claimed), 'first cooldown slot claimed');
with claimed as (
  update public.leetcode_sync_settings set last_attempt_at=now()
  where user_id=private.student_id() and enabled and (last_attempt_at is null or last_attempt_at < now()-interval '2 minutes') returning user_id
) select pg_temp.sync_assert((select count(*)=0 from claimed), 'repeat cooldown slot denied');

select set_config('prepyard.student_id', current_setting('test.sync_b'), true);
select pg_temp.sync_assert((select count(*)=0 from public.leetcode_sync_settings), 'other student cannot read profile');
select pg_temp.sync_assert((select count(*)=0 from public.leetcode_sync_receipts), 'other student cannot read receipts');
select pg_temp.sync_denied('insert into public.leetcode_sync_settings(user_id,username) values(current_setting(''test.sync_a'')::uuid,''stolen'')');
select pg_temp.sync_denied('insert into public.leetcode_sync_receipts(user_id,submission_id,question_id,submitted_at) values(current_setting(''test.sync_a'')::uuid,''222'',current_setting(''test.sync_question'')::uuid,now())');
with deleted as (delete from public.leetcode_sync_settings returning user_id) select pg_temp.sync_assert((select count(*)=0 from deleted), 'other student cannot delete settings');
with deleted as (delete from public.leetcode_sync_receipts returning user_id) select pg_temp.sync_assert((select count(*)=0 from deleted), 'other student cannot delete receipts');

select set_config('prepyard.student_id', current_setting('test.sync_a'), true);
insert into public.leetcode_sync_receipts(user_id, submission_id, question_id, submitted_at) values(private.student_id(), '123456789', current_setting('test.sync_question')::uuid, now()) on conflict(user_id,submission_id) do nothing;
select pg_temp.sync_assert((select count(*)=1 from public.leetcode_sync_receipts), 'receipt identity is idempotent');
reset role;
rollback;
