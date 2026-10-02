-- Stable catalogue identity and provenance. Auth objects are provided by Supabase.
begin;

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

create table public.platforms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 1 and 100),
  base_url text not null check (base_url ~ '^https://[^/[:space:]]+'),
  created_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 1 and 200),
  url text not null check (url ~ '^https://[^/[:space:]]+'),
  adapter text not null check (length(btrim(adapter)) between 1 and 100),
  attribution text not null check (length(btrim(attribution)) between 1 and 2000),
  reuse_status text not null default 'pending' check (reuse_status in ('pending','approved','restricted')),
  enabled boolean not null default false,
  is_public boolean not null default false,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not enabled or reuse_status = 'approved')
);
comment on table public.sources is 'Public-safe provenance only. Never store credentials, private repository URLs, or internal error details here.';

create table public.company_aliases (
  source_id uuid not null references public.sources(id) on delete cascade,
  alias text not null check (length(btrim(alias)) between 1 and 200),
  company_id uuid not null references public.companies(id) on delete restrict,
  primary key (source_id, alias)
);
create unique index company_alias_normalized on public.company_aliases(source_id, lower(btrim(alias)));
create index company_alias_company on public.company_aliases(company_id);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete restrict,
  external_id text check (external_id is null or length(btrim(external_id)) between 1 and 200),
  canonical_url text not null check (canonical_url ~ '^https://[^/[:space:]]+' and length(canonical_url) <= 2048),
  title text not null check (length(btrim(title)) between 1 and 500),
  difficulty text check (difficulty in ('easy','medium','hard')),
  original_difficulty text check (length(original_difficulty) <= 100),
  is_listed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(platform_id, canonical_url),
  unique(platform_id, external_id)
);
comment on column public.questions.is_listed is 'False for newly staged questions. Publication exposes metadata permanently; old associations can retire without destroying practice history.';
create index questions_catalogue on public.questions(platform_id, difficulty, id) where is_listed;
create index questions_title_search on public.questions using gin(to_tsvector('simple', title));

create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 1 and 200),
  description text not null default '' check (length(description) <= 5000),
  position integer not null default 0 check (position >= 0)
);
create table public.question_patterns (
  question_id uuid not null references public.questions(id) on delete cascade,
  pattern_id uuid not null references public.patterns(id) on delete cascade,
  mapping_source text not null check (length(btrim(mapping_source)) between 1 and 500),
  reviewed boolean not null default false,
  primary key(question_id, pattern_id)
);
create index question_patterns_pattern on public.question_patterns(pattern_id, question_id);

create table public.source_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete restrict,
  revision text not null check (length(btrim(revision)) between 1 and 200),
  dataset_date date,
  imported_at timestamptz not null default now(),
  published_at timestamptz,
  status text not null default 'staged' check (status in ('staged','validated','published','archived','rejected')),
  unique(source_id, revision),
  unique(id, source_id),
  check ((status in ('published','archived')) = (published_at is not null))
);
create unique index one_published_snapshot_per_source on public.source_snapshots(source_id) where status = 'published';
create index snapshots_source_history on public.source_snapshots(source_id, imported_at desc);

create table public.company_question_observations (
  snapshot_id uuid not null references public.source_snapshots(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  question_id uuid not null references public.questions(id) on delete restrict,
  time_window text not null check (time_window in ('30d','60d','90d','180d','1y','2y','older-than-180d','all')),
  frequency numeric,
  frequency_kind text not null default 'unknown' check (frequency_kind in ('unknown','percent','count','score')),
  source_rank integer check (source_rank > 0),
  acceptance_percent numeric check (acceptance_percent between 0 and 100),
  primary key(snapshot_id, company_id, question_id, time_window),
  check (
    (frequency_kind = 'unknown' and frequency is null)
    or (frequency_kind = 'percent' and frequency is not null and frequency between 0 and 100)
    or (frequency_kind = 'count' and frequency is not null and frequency >= 0 and frequency < 'Infinity'::numeric and frequency = trunc(frequency))
    or (frequency_kind = 'score' and frequency is not null and frequency >= 0 and frequency < 'Infinity'::numeric)
  )
);
create index observations_company_frequency on public.company_question_observations
  (company_id, time_window, snapshot_id, frequency desc nulls last, question_id);
create index observations_question on public.company_question_observations(question_id, company_id);

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete restrict,
  snapshot_id uuid,
  status text not null default 'running' check (status in ('running','succeeded','failed','unchanged')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  added_count integer not null default 0 check (added_count >= 0),
  changed_count integer not null default 0 check (changed_count >= 0),
  removed_count integer not null default 0 check (removed_count >= 0),
  error_details text check (length(error_details) <= 20000),
  foreign key(snapshot_id, source_id) references public.source_snapshots(id, source_id) on delete restrict,
  check ((status = 'running') = (finished_at is null)),
  check (finished_at is null or finished_at >= started_at)
);
create index import_runs_source on public.import_runs(source_id, started_at desc);
create index import_runs_snapshot on public.import_runs(snapshot_id);
comment on table public.import_runs is 'Server-only operational logs. Do not put secrets in error_details.';

create trigger sources_updated before update on public.sources for each row execute function public.touch_updated_at();
create trigger questions_updated before update on public.questions for each row execute function public.touch_updated_at();
-- Fail closed even if a later migration cannot be applied.
do $$ declare t text; begin
  foreach t in array array['platforms','companies','sources','company_aliases','questions','patterns','question_patterns','source_snapshots','company_question_observations','import_runs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public, anon, authenticated',t);
    execute format('grant select, insert, update, delete on table public.%I to service_role',t);
  end loop;
end $$;
commit;
