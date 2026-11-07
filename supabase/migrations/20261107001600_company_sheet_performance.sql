-- 
-- then groups observations by question across published snapshots.
create index observations_company_sheet_lookup
  on public.company_question_observations (company_id, time_window, question_id)
  include (frequency, acceptance_percent)
  where frequency_kind in ('percent', 'unknown');
