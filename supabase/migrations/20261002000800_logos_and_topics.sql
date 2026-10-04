begin;
-- Brand marks and LeetCode topic tags for the published catalogue.
-- Both are reference metadata about a question or company, never student content,
-- so they follow the same authenticated-only exposure rules as questions.

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);
comment on table public.topics is 'LeetCode topic tags such as array, strings or dynamic-programming. Names are owned by the platform, so only the slug is ever accepted from a client.';
create table public.question_topics (
  question_id uuid not null references public.questions(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  source text not null check (length(btrim(source)) between 1 and 200),
  primary key(question_id, topic_id)
);
comment on column public.question_topics.source is 'Provenance of the mapping, recorded so a platform change can be traced and revoked.';
create index question_topics_topic on public.question_topics(topic_id, question_id);
create index question_topics_question on public.question_topics(question_id, topic_id);

-- Logo bytes are stored rather than a third-party URL so a card never renders a
-- broken image, a tracking pixel or a request to somebody else's CDN.
create table public.company_logos (
  company_id uuid primary key references public.companies(id) on delete cascade,
  content_type text not null check (content_type in ('image/svg+xml','image/png','image/webp','image/x-icon')),
  image bytea not null check (octet_length(image) between 32 and 262144),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  source text not null check (length(btrim(source)) between 1 and 200),
  attribution text not null default '' check (length(attribution) <= 2000),
  created_at timestamptz not null default now()
);
comment on table public.company_logos is 'One stored brand mark per company. Companies without a stored mark render a generated monogram instead; absence is normal and never an error.';
comment on column public.company_logos.image is 'Original bytes exactly as fetched. Never rewritten, recompressed or scaled by the application.';
comment on column public.company_logos.source is 'Where the bytes came from, so a mark can be replaced or withdrawn when its licence changes.';

do $$ declare t text; begin
  foreach t in array array['topics','question_topics','company_logos'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  end loop;
end $$;
grant select on public.topics, public.question_topics, public.company_logos to authenticated;

-- The favicon and brand-mark services are third parties, so a stored mark is only
-- readable by an identified student, and never outside this deployment.
create policy topics_read on public.topics for select to authenticated
 using (private.student_id() is not null);
create policy question_topics_read on public.question_topics for select to authenticated
 using (private.student_id() is not null);
create policy company_logos_read on public.company_logos for select to authenticated
 using (private.student_id() is not null and exists(select 1 from public.companies c where c.id=company_id));

commit;