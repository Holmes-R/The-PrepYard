begin;
create table public.sheets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 5000),
  visibility text not null default 'private' check (visibility in ('private','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.sheets.owner_id is 'NULL denotes a server-curated sheet. Ordinary clients may never create or take ownership of curated sheets.';
create index sheets_owner on public.sheets(owner_id, updated_at desc);
create index sheets_public on public.sheets(updated_at desc) where visibility = 'public';

create table public.sheet_items (
  sheet_id uuid not null references public.sheets(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  section text not null default 'Questions' check (length(btrim(section)) between 1 and 200),
  position integer not null check (position >= 0),
  primary key(sheet_id, question_id),
  unique(sheet_id, section, position) deferrable initially immediate
);
create index sheet_items_question on public.sheet_items(question_id);

create table public.user_question_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  status text not null default 'not_started' check (status in ('not_started','attempted','solved')),
  bookmarked boolean not null default false,
  confidence smallint check (confidence between 1 and 5),
  next_revision_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id, question_id)
);
create index state_question on public.user_question_state(question_id);
create index state_revision on public.user_question_state(user_id, next_revision_at) where next_revision_at is not null;
create index state_bookmarked on public.user_question_state(user_id, updated_at desc) where bookmarked;

create table public.notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  content text not null check (length(btrim(content)) between 1 and 50000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id, question_id)
);
create index notes_question on public.notes(question_id);

create table public.practice_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  event_type text not null check (event_type in ('attempted','solved','reviewed')),
  duration_seconds integer check (duration_seconds between 0 and 86400),
  occurred_at timestamptz not null default now()
);
create index events_user_time on public.practice_events(user_id, occurred_at desc);
create index events_question on public.practice_events(question_id);

create table public.correction_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  details text not null check (length(btrim(details)) between 10 and 5000),
  status text not null default 'open' check (status in ('open','accepted','rejected')),
  resolution text check (length(resolution) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index corrections_reporter on public.correction_reports(reporter_id, created_at desc);
create index corrections_question on public.correction_reports(question_id);
create index corrections_open on public.correction_reports(created_at) where status = 'open';

create trigger sheets_updated before update on public.sheets for each row execute function public.touch_updated_at();
create trigger state_updated before update on public.user_question_state for each row execute function public.touch_updated_at();
create trigger notes_updated before update on public.notes for each row execute function public.touch_updated_at();
create trigger corrections_updated before update on public.correction_reports for each row execute function public.touch_updated_at();
-- Fail closed even if a later migration cannot be applied.
do $$ declare t text; begin
  foreach t in array array['sheets','sheet_items','user_question_state','notes','practice_events','correction_reports'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public, anon, authenticated',t);
    execute format('grant select, insert, update, delete on table public.%I to service_role',t);
  end loop;
end $$;
commit;
