begin;
alter table public.practice_events add column confidence smallint;
alter table public.practice_events add constraint practice_events_confidence_check
  check (confidence is null or (event_type = 'reviewed' and confidence between 1 and 4));
create index events_revision_history on public.practice_events(user_id,question_id,occurred_at desc,id desc) where event_type='reviewed';
comment on column public.practice_events.confidence is 'Confidence selected for this specific revision; null for historical events without a recorded rating.';
commit;
