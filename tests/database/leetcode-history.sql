begin;
create function pg_temp.history_assert(value boolean,label text) returns void language plpgsql as $$
begin if not coalesce(value,false) then raise exception 'History assertion: %',label; end if; end $$;
create function pg_temp.history_denied(statement text) returns void language plpgsql as $$
begin execute statement; raise exception 'Expected denial'; exception when insufficient_privilege then null; end $$;
select set_config('test.history_a',gen_random_uuid()::text,true);
select set_config('test.history_b',gen_random_uuid()::text,true);
insert into private.students(id,name) values(current_setting('test.history_a')::uuid,'History A'),(current_setting('test.history_b')::uuid,'History B');
select pg_temp.history_assert((select relrowsecurity from pg_class where oid='public.leetcode_history_questions'::regclass),'RLS enabled');
set local role anon;
select pg_temp.history_denied('select * from public.leetcode_history_questions');
reset role;
set local role authenticated;
select set_config('prepyard.student_id',current_setting('test.history_a'),true);
insert into public.leetcode_history_questions(user_id,slug) values(private.student_id(),'two-sum');
insert into public.leetcode_history_questions(user_id,slug) values(private.student_id(),'two-sum') on conflict(user_id,slug) do nothing;
select pg_temp.history_assert((select count(*)=1 from public.leetcode_history_questions),'unique receipt');
select pg_temp.history_denied('update public.leetcode_history_questions set user_id=current_setting(''test.history_b'')::uuid');
select set_config('prepyard.student_id',current_setting('test.history_b'),true);
select pg_temp.history_assert((select count(*)=0 from public.leetcode_history_questions),'other student cannot read');
select pg_temp.history_denied('insert into public.leetcode_history_questions(user_id,slug) values(current_setting(''test.history_a'')::uuid,''stolen'')');
with updated as(update public.leetcode_history_questions set slug='stolen' returning user_id)
select pg_temp.history_assert((select count(*)=0 from updated),'other student cannot update');
with deleted as(delete from public.leetcode_history_questions returning user_id)
select pg_temp.history_assert((select count(*)=0 from deleted),'other student cannot delete');
reset role;
rollback;
