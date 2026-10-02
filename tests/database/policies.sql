-- Integration tests use real PostgreSQL grants and RLS. All fixtures roll back.
begin;
create function pg_temp.assert_true(result boolean, label text) returns void
language plpgsql as $$
begin if result is distinct from true then raise exception 'FAIL: %', label; end if; end $$;
create function pg_temp.expect_error(statement text, expected text, label text) returns void
language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate = expected then return; end if;
    raise exception 'FAIL: %, expected %, got %: %', label, expected, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: %, statement unexpectedly succeeded', label;
end $$;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into public.platforms(id,slug,name,base_url) values ('10000000-0000-4000-8000-000000000001','test-platform','Test','https://example.test');
insert into public.companies(id,slug,name) values ('20000000-0000-4000-8000-000000000001','test-company','Test Company');
insert into public.sources(id,slug,name,url,adapter,attribution,reuse_status,enabled,is_public)
values ('40000000-0000-4000-8000-000000000001','approved','Approved','https://example.test/repo','csv','Fixture only','approved',true,true),
('40000000-0000-4000-8000-000000000002','pending','Pending','https://example.test/pending','csv','Fixture only','pending',false,false);
insert into public.company_aliases values ('40000000-0000-4000-8000-000000000001','Company Alias','20000000-0000-4000-8000-000000000001');
insert into public.questions(id,platform_id,external_id,canonical_url,title)
values ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','1','https://example.test/1','First question'),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','2','https://example.test/2','Staged question');
insert into public.patterns(id,slug,name) values ('70000000-0000-4000-8000-000000000001','test-pattern','Test pattern');
insert into public.question_patterns values ('30000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','fixture',true),('30000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000001','fixture',false);
insert into public.source_snapshots(id,source_id,revision,status) values
('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','rev1','validated'),
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','rev2','validated'),
('50000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000001','empty','validated'),
('50000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000001','staged','staged');
insert into public.company_question_observations(snapshot_id,company_id,question_id,time_window,frequency,frequency_kind)
values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','30d',80,'percent'),
('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002','30d',null,'unknown');
select pg_temp.assert_true((select count(*) = 16 from pg_tables where schemaname='public' and rowsecurity), 'all application tables have RLS');
select pg_temp.expect_error($test$insert into public.questions(platform_id,external_id,canonical_url,title) values ('10000000-0000-4000-8000-000000000001','1','https://example.test/duplicate','Duplicate')$test$, '23505', 'stable platform problem identity');
select pg_temp.expect_error($test$insert into public.questions(platform_id,canonical_url,title) values ('10000000-0000-4000-8000-000000000001','https://example.test/1','Duplicate')$test$, '23505', 'canonical URL identity');
select pg_temp.expect_error($test$insert into public.company_aliases values ('40000000-0000-4000-8000-000000000001',' company ALIAS ','20000000-0000-4000-8000-000000000001')$test$, '23505', 'case-insensitive alias deduplication');
select pg_temp.expect_error($test$update public.company_question_observations set frequency=101 where snapshot_id='50000000-0000-4000-8000-000000000001'$test$, '23514', 'percentage bounds');
select pg_temp.expect_error($test$update public.company_question_observations set frequency=null where snapshot_id='50000000-0000-4000-8000-000000000001'$test$, '23514', 'known frequency requires value');
select pg_temp.expect_error($test$update public.company_question_observations set frequency=1 where snapshot_id='50000000-0000-4000-8000-000000000002'$test$, '23514', 'unknown frequency must remain null');
select pg_temp.expect_error($test$update public.company_question_observations set frequency_kind='count',frequency=1.5 where snapshot_id='50000000-0000-4000-8000-000000000001'$test$, '23514', 'counts are whole numbers');
select pg_temp.expect_error($test$update public.company_question_observations set frequency_kind='score',frequency='NaN' where snapshot_id='50000000-0000-4000-8000-000000000001'$test$, '23514', 'nonfinite frequency rejected');
select pg_temp.expect_error($test$update public.company_question_observations set acceptance_percent=-1 where snapshot_id='50000000-0000-4000-8000-000000000001'$test$, '23514', 'acceptance bounds');
select pg_temp.expect_error($test$update public.company_question_observations set source_rank=0 where snapshot_id='50000000-0000-4000-8000-000000000001'$test$, '23514', 'rank is positive');
select pg_temp.expect_error($test$update public.sources set enabled=true where id='40000000-0000-4000-8000-000000000002'$test$, '23514', 'unapproved sources cannot enable');
select pg_temp.expect_error($test$update public.source_snapshots set status='published' where id='50000000-0000-4000-8000-000000000001'$test$, '23514', 'published date consistency');
reset role;
select set_config('request.jwt.claim.sub','', true);
set local role anon;
select pg_temp.assert_true((select count(*)=1 from public.platforms), 'anonymous reads platforms');
select pg_temp.assert_true((select count(*)=1 from public.companies), 'anonymous reads companies');
select pg_temp.assert_true((select count(*)=1 from public.patterns), 'anonymous reads patterns');
select pg_temp.assert_true((select count(*)=1 from public.sources), 'pending source hidden');
select pg_temp.assert_true((select count(*)=0 from public.questions), 'staged questions hidden');
select pg_temp.assert_true((select count(*)=0 from public.source_snapshots), 'staged source_snapshots hidden');
select pg_temp.assert_true((select count(*)=0 from public.company_question_observations), 'staged company_question_observations hidden');
select pg_temp.assert_true((select count(*)=0 from public.question_patterns), 'staged question_patterns hidden');
select pg_temp.expect_error($test$select * from public.company_aliases$test$, '42501', 'anonymous cannot read company_aliases');
select pg_temp.expect_error($test$select * from public.import_runs$test$, '42501', 'anonymous cannot read import_runs');
select pg_temp.expect_error($test$select * from public.notes$test$, '42501', 'anonymous cannot read notes');
select pg_temp.expect_error($test$select * from public.user_question_state$test$, '42501', 'anonymous cannot read user_question_state');
select pg_temp.expect_error($test$select * from public.practice_events$test$, '42501', 'anonymous cannot read practice_events');
select pg_temp.expect_error($test$select * from public.correction_reports$test$, '42501', 'anonymous cannot read correction_reports');
select pg_temp.expect_error($test$insert into public.companies(slug,name) values ('bad','Bad')$test$, '42501', 'anonymous catalogue insert denied');
select pg_temp.expect_error($test$update public.questions set title='Bad'$test$, '42501', 'anonymous catalogue update denied');
select pg_temp.expect_error($test$delete from public.sources$test$, '42501', 'anonymous catalogue delete denied');
select pg_temp.expect_error($test$select public.publish_source_snapshot('50000000-0000-4000-8000-000000000001')$test$, '42501', 'anonymous cannot publish');
reset role;
select set_config('request.jwt.claim.sub','', true);
set local role service_role;
select public.publish_source_snapshot('50000000-0000-4000-8000-000000000001');
select public.publish_source_snapshot('50000000-0000-4000-8000-000000000001');
select pg_temp.assert_true((select count(*)=1 from public.source_snapshots where status='published'), 'idempotent publication');
select pg_temp.expect_error($test$select public.publish_source_snapshot('50000000-0000-4000-8000-000000000003')$test$, '22023', 'empty publication rejected');
select pg_temp.expect_error($test$select public.publish_source_snapshot('50000000-0000-4000-8000-000000000004')$test$, '22023', 'unvalidated publication rejected');
select pg_temp.assert_true((select status='published' from public.source_snapshots where id='50000000-0000-4000-8000-000000000001'), 'failed publication preserves active snapshot');
insert into public.import_runs(source_id,status,finished_at) values ('40000000-0000-4000-8000-000000000001','succeeded',now());
select pg_temp.assert_true((select count(*)=1 from public.import_runs), 'server can record imports');
reset role;
select set_config('request.jwt.claim.sub','', true);
set local role anon;
select pg_temp.assert_true((select count(*)=1 from public.questions), 'only published question visible');
select pg_temp.assert_true((select count(*)=1 from public.source_snapshots), 'only published provenance visible');
select pg_temp.assert_true((select count(*)=1 from public.company_question_observations), 'published observation visible');
select pg_temp.assert_true((select count(*)=1 from public.question_patterns), 'reviewed published mapping visible');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
select pg_temp.expect_error($test$insert into public.questions(platform_id,canonical_url,title) values ('10000000-0000-4000-8000-000000000001','https://example.test/bad','Bad')$test$, '42501', 'authenticated catalogue insert denied');
select pg_temp.expect_error($test$update public.questions set title='Bad'$test$, '42501', 'authenticated catalogue update denied');
select pg_temp.expect_error($test$delete from public.company_question_observations$test$, '42501', 'authenticated catalogue delete denied');
select pg_temp.expect_error($test$select public.publish_source_snapshot('50000000-0000-4000-8000-000000000002')$test$, '42501', 'authenticated cannot publish');
select pg_temp.expect_error($test$select * from public.import_runs$test$, '42501', 'authenticated import logs denied');
insert into public.sheets(id,owner_id,slug,title) values ('60000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','alice-private','Alice private');
insert into public.sheets(id,owner_id,slug,title,visibility) values ('60000000-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','alice-public','Alice public','public');
insert into public.sheet_items(sheet_id,question_id,position) values ('60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',0),('60000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',0);
insert into public.user_question_state(user_id,question_id,status) values ('11111111-1111-4111-8111-111111111111','30000000-0000-4000-8000-000000000001','attempted');
insert into public.notes(user_id,question_id,content) values ('11111111-1111-4111-8111-111111111111','30000000-0000-4000-8000-000000000001','Alice private note');
insert into public.practice_events(user_id,question_id,event_type) values ('11111111-1111-4111-8111-111111111111','30000000-0000-4000-8000-000000000001','attempted');
insert into public.correction_reports(reporter_id,question_id,details) values ('11111111-1111-4111-8111-111111111111','30000000-0000-4000-8000-000000000001','Please check the company association.');
select pg_temp.assert_true((select count(*)=1 from public.user_question_state), 'owner reads user_question_state');
select pg_temp.assert_true((select count(*)=1 from public.notes), 'owner reads notes');
select pg_temp.assert_true((select count(*)=1 from public.practice_events), 'owner reads practice_events');
select pg_temp.assert_true((select count(*)=1 from public.correction_reports), 'owner reads correction_reports');
update public.user_question_state set status='solved',confidence=4 where user_id='11111111-1111-4111-8111-111111111111';
update public.notes set content='Updated note' where user_id='11111111-1111-4111-8111-111111111111';
select pg_temp.assert_true((select status='solved' from public.user_question_state), 'owner updates status');
select pg_temp.assert_true((select content='Updated note' from public.notes), 'owner updates note');
select pg_temp.expect_error($test$update public.user_question_state set confidence=6$test$, '23514', 'confidence bounds');
select pg_temp.expect_error($test$insert into public.notes(user_id,question_id,content) values ('11111111-1111-4111-8111-111111111111','30000000-0000-4000-8000-000000000002','Hidden question')$test$, '42501', 'cannot save unpublished question');
select pg_temp.expect_error($test$insert into public.sheet_items(sheet_id,question_id,position) values ('60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',1)$test$, '42501', 'cannot add unpublished question to sheet');
select pg_temp.expect_error($test$insert into public.correction_reports(reporter_id,question_id,details,status) values ('11111111-1111-4111-8111-111111111111','30000000-0000-4000-8000-000000000001','Spoof moderation status','accepted')$test$, '42501', 'reporters cannot set moderation status');
select pg_temp.expect_error($test$update public.correction_reports set status='accepted'$test$, '42501', 'reporters cannot moderate reports');
select pg_temp.expect_error($test$update public.practice_events set event_type='solved'$test$, '42501', 'practice events append only');
select pg_temp.expect_error($test$insert into public.sheets(owner_id,slug,title) values (null,'fake-curated','Fake curated')$test$, '42501', 'users cannot create curated sheets');
reset role;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222', true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.user_question_state), 'Bob cannot read Alice user_question_state');
select pg_temp.assert_true((select count(*)=0 from public.notes), 'Bob cannot read Alice notes');
select pg_temp.assert_true((select count(*)=0 from public.practice_events), 'Bob cannot read Alice practice_events');
select pg_temp.assert_true((select count(*)=0 from public.correction_reports), 'Bob cannot read Alice correction_reports');
select pg_temp.assert_true((select count(*)=1 from public.sheets), 'Bob sees public sheets only');
select pg_temp.assert_true((select count(*)=1 from public.sheet_items), 'private sheet items hidden');
with changed as (update public.notes set content='Hacked' returning 1) select pg_temp.assert_true((select count(*)=0 from changed),'cross-user notes update affects no rows');
with changed as (update public.user_question_state set status='solved' returning 1) select pg_temp.assert_true((select count(*)=0 from changed),'cross-user user_question_state update affects no rows');
with changed as (update public.sheets set title='Hacked' returning 1) select pg_temp.assert_true((select count(*)=0 from changed),'cross-user sheets update affects no rows');
with changed as (update public.sheet_items set section='Hacked' returning 1) select pg_temp.assert_true((select count(*)=0 from changed),'cross-user sheet_items update affects no rows');
with removed as (delete from public.notes returning 1) select pg_temp.assert_true((select count(*)=0 from removed),'cross-user notes delete affects no rows');
with removed as (delete from public.user_question_state returning 1) select pg_temp.assert_true((select count(*)=0 from removed),'cross-user user_question_state delete affects no rows');
with removed as (delete from public.practice_events returning 1) select pg_temp.assert_true((select count(*)=0 from removed),'cross-user practice_events delete affects no rows');
with removed as (delete from public.sheets returning 1) select pg_temp.assert_true((select count(*)=0 from removed),'cross-user sheets delete affects no rows');
with removed as (delete from public.sheet_items returning 1) select pg_temp.assert_true((select count(*)=0 from removed),'cross-user sheet_items delete affects no rows');
select pg_temp.expect_error($test$insert into public.notes(user_id,question_id,content) values ('11111111-1111-4111-8111-111111111111','30000000-0000-4000-8000-000000000001','Forged note')$test$, '42501', 'spoofed notes insert rejected');
select pg_temp.expect_error($test$insert into public.user_question_state(user_id,question_id) values ('11111111-1111-4111-8111-111111111111','30000000-0000-4000-8000-000000000001')$test$, '42501', 'spoofed user_question_state insert rejected');
select pg_temp.expect_error($test$insert into public.practice_events(user_id,question_id,event_type) values ('11111111-1111-4111-8111-111111111111','30000000-0000-4000-8000-000000000001','solved')$test$, '42501', 'spoofed practice_events insert rejected');
select pg_temp.expect_error($test$insert into public.correction_reports(reporter_id,question_id,details) values ('11111111-1111-4111-8111-111111111111','30000000-0000-4000-8000-000000000001','Forged report from Bob')$test$, '42501', 'spoofed correction_reports insert rejected');
select pg_temp.expect_error($test$insert into public.sheets(owner_id,slug,title) values ('11111111-1111-4111-8111-111111111111','forged','Forged sheet')$test$, '42501', 'spoofed sheets insert rejected');
select pg_temp.expect_error($test$insert into public.sheet_items(sheet_id,question_id,position) values ('60000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1)$test$, '42501', 'spoofed sheet_items insert rejected');
insert into public.notes(user_id,question_id,content) values ('22222222-2222-4222-8222-222222222222','30000000-0000-4000-8000-000000000001','Bob note');
insert into public.sheets(id,owner_id,slug,title) values ('60000000-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222','bob-private','Bob private');
select pg_temp.expect_error($test$update public.notes set user_id='11111111-1111-4111-8111-111111111111'$test$, '42501', 'note ownership transfer denied');
select pg_temp.expect_error($test$update public.sheets set owner_id='11111111-1111-4111-8111-111111111111' where id='60000000-0000-4000-8000-000000000004'$test$, '42501', 'sheet ownership transfer denied');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
select pg_temp.expect_error($test$update public.sheet_items set sheet_id='60000000-0000-4000-8000-000000000004' where sheet_id='60000000-0000-4000-8000-000000000001'$test$, '42501', 'moving items to foreign sheet denied');
select pg_temp.assert_true((select content='Updated note' from public.notes), 'Alice data survived cross-user attempts');
update public.sheets set title='Updated private' where id='60000000-0000-4000-8000-000000000001';
update public.sheet_items set section='Arrays' where sheet_id='60000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select title='Updated private' from public.sheets where id='60000000-0000-4000-8000-000000000001'), 'owner can edit sheet');
select pg_temp.assert_true((select section='Arrays' from public.sheet_items where sheet_id='60000000-0000-4000-8000-000000000001'), 'owner can edit sheet item');
reset role;
select set_config('request.jwt.claim.sub','', true);
set local role service_role;
insert into public.sheets(id,slug,title,visibility) values ('60000000-0000-4000-8000-000000000003','curated','Curated','public');
select public.publish_source_snapshot('50000000-0000-4000-8000-000000000002');
select pg_temp.assert_true((select status='archived' from public.source_snapshots where id='50000000-0000-4000-8000-000000000001'), 'previous snapshot archived');
select pg_temp.assert_true((select count(*)=2 from public.notes), 'publication preserves private notes');
select pg_temp.assert_true((select count(*)=1 from public.user_question_state), 'publication preserves progress');
select pg_temp.expect_error($test$update public.source_snapshots set status='published' where id='50000000-0000-4000-8000-000000000001'$test$, '23505', 'only one active snapshot per source');
select public.publish_source_snapshot('50000000-0000-4000-8000-000000000001');
select pg_temp.assert_true((select status='published' from public.source_snapshots where id='50000000-0000-4000-8000-000000000001'), 'rollback to previous snapshot');
reset role;
select set_config('request.jwt.claim.sub','', true);
set local role anon;
select pg_temp.assert_true((select count(*)=2 from public.questions), 'previously published metadata retained');
select pg_temp.assert_true((select count(*)=1 from public.company_question_observations), 'only current observations exposed');
select pg_temp.assert_true((select count(*)=2 from public.source_snapshots), 'historical provenance exposed');
select pg_temp.assert_true((select count(*)=2 from public.sheets), 'anonymous sees public personal and curated sheets');
select pg_temp.assert_true((select count(*)=1 from public.sheet_items), 'anonymous sees only public sheet contents');
select pg_temp.expect_error($test$insert into public.sheets(slug,title) values ('anon','Anon')$test$, '42501', 'anonymous cannot create sheets');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
with changed as (update public.sheets set owner_id='11111111-1111-4111-8111-111111111111' where id='60000000-0000-4000-8000-000000000003' returning 1)
select pg_temp.assert_true((select count(*)=0 from changed),'cannot claim curated sheet');
delete from public.sheets where id='60000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select count(*)=1 from public.sheet_items), 'deleting own sheet cascades items only');
delete from public.notes; delete from public.user_question_state; delete from public.practice_events;
select pg_temp.assert_true((select count(*)=0 from public.notes), 'owner can delete notes');
select pg_temp.assert_true((select count(*)=0 from public.user_question_state), 'owner can delete user_question_state');
select pg_temp.assert_true((select count(*)=0 from public.practice_events), 'owner can delete practice_events');
reset role;
select set_config('request.jwt.claim.sub','', true);
set local role postgres;
select pg_temp.assert_true((select count(*)=1 from public.notes), 'Bob note survived Alice deletes');
select pg_temp.expect_error($test$insert into public.notes(user_id,question_id,content) values ('11111111-1111-4111-8111-111111111111','99999999-9999-4999-8999-999999999999','No question')$test$, '23503', 'question foreign key enforced');
delete from auth.users where id='22222222-2222-4222-8222-222222222222';
select pg_temp.assert_true((select count(*)=0 from public.notes), 'account deletion cascades private notes');
select pg_temp.assert_true((select count(*)=2 from public.questions), 'account deletion preserves catalogue');

-- Additional schema and fail-closed checks.
select pg_temp.expect_error($test$insert into public.import_runs(source_id,snapshot_id) values ('40000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000001')$test$,'23503','import snapshot must belong to source');
select pg_temp.expect_error($test$insert into public.source_snapshots(source_id,revision) values ('40000000-0000-4000-8000-000000000001','rev1')$test$,'23505','source revision deduplication');
select pg_temp.expect_error($test$update public.questions set title='   ' where id='30000000-0000-4000-8000-000000000001'$test$,'23514','blank titles rejected');
select pg_temp.expect_error($test$update public.questions set canonical_url='javascript:alert(1)' where id='30000000-0000-4000-8000-000000000001'$test$,'23514','non-HTTPS problem links rejected');
select pg_temp.expect_error($test$update public.company_question_observations set time_window='tomorrow' where snapshot_id='50000000-0000-4000-8000-000000000001'$test$,'23514','unsupported windows rejected');
select pg_temp.expect_error($test$update public.company_question_observations set frequency_kind='score',frequency='Infinity' where snapshot_id='50000000-0000-4000-8000-000000000001'$test$,'23514','infinite scores rejected');
update public.sources set is_public=false where id='40000000-0000-4000-8000-000000000001';
set local role anon;
select pg_temp.assert_true((select count(*)=0 from public.sources),'private source hidden');
select pg_temp.assert_true((select count(*)=0 from public.source_snapshots),'private source snapshots hidden');
select pg_temp.assert_true((select count(*)=0 from public.company_question_observations),'private source observations hidden');
reset role;
update public.sources set is_public=true,enabled=false where id='40000000-0000-4000-8000-000000000001';
set local role service_role;
select pg_temp.expect_error($test$select public.publish_source_snapshot('50000000-0000-4000-8000-000000000002')$test$,'22023','disabled source cannot publish');
reset role;
select pg_temp.assert_true((select status='published' from public.source_snapshots where id='50000000-0000-4000-8000-000000000001'),'disabled publication preserves current snapshot');
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.assert_true((select count(*)=0 from public.correction_reports),'missing auth identity has no private access');
reset role;

rollback;
select '117 database assertions passed' as result;
