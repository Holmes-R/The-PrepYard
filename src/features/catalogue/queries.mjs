export {
  windowLabels,
  progressLabels,
  filtersFrom,
  filtersToParams,
} from "./filters.mjs";
import { practiceQuestionsSql } from "../questions/practice.mjs";
import { decorateRoadmapQuestions } from "../patterns/roadmap.mjs";
import {
  orderSql,
  revisionExpressions,
  difficultyExpression,
} from "../questions/sorting.mjs";
export const companiesSql = `select c.slug,c.name,exists(select 1 from public.company_logos l where l.company_id=c.id) as has_logo,
 count(distinct q.id)::int as question_count,
 count(distinct q.id) filter(where u.status='solved')::int as solved_count,
 count(distinct q.id) filter(where q.difficulty='easy')::int as easy_count,
 count(distinct q.id) filter(where q.difficulty='medium')::int as medium_count,
 count(distinct q.id) filter(where q.difficulty='hard')::int as hard_count
 from public.companies c join public.company_question_observations o on o.company_id=c.id
 left join ${practiceQuestionsSql} q on q.id=o.question_id and q.is_listed
 left join public.user_question_state u on u.question_id=q.id and u.user_id=private.student_id()
 group by c.id,c.slug,c.name order by lower(c.name),c.slug`;
// Serializes applied filters for the address bar, so a filtered sheet is shareable
// and survives reloads. Empty values are omitted so the reader on the other side
// sees the documented defaults; `open` names the expanded company on /companies.
// Topics the company actually has questions for, most used first. Drives the topic
// filter so it never offers a tag that would return nothing.
export async function companyTopics(client, companyId) {
  return (
    await client.query(
      `select t.slug,t.name,count(distinct qt.question_id)::int as uses
       from public.question_topics qt
       join public.topics t on t.id=qt.topic_id
       join public.company_question_observations o on o.question_id=qt.question_id
       join ${practiceQuestionsSql} q on q.id=qt.question_id and q.is_listed
       where o.company_id=$1
       group by t.slug,t.name
       order by count(distinct qt.question_id) desc,t.name`,
      [companyId],
    )
  ).rows;
}
// Every logo for the visible cards in one query. The directory used to fire one
// authenticated request per logo, and each of those paid for middleware session
// validation, a pool checkout against a pool of five, and a full transaction.
// This pays all three once no matter how many cards are on screen.
export async function companyLogos(client, slugs) {
  const clean = [...new Set(slugs ?? [])]
    .filter(
      (s) =>
        typeof s === "string" &&
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) &&
        s.length <= 200,
    )
    .slice(0, 64);
  if (!clean.length) return {};
  const { rows } = await client.query(
    `select c.slug,l.content_type,encode(l.image,'base64') as data,l.sha256
     from public.company_logos l
     join public.companies c on c.id=l.company_id
     where c.slug = any($1)`,
    [clean],
  );
  return Object.fromEntries(
    rows.map((r) => [
      r.slug,
      { content_type: r.content_type, data: r.data, sha256: r.sha256 },
    ]),
  );
}
export const companyCatalogueSql = `select c.id,c.slug,c.name,
 exists(select 1 from public.company_logos l where l.company_id=c.id) as has_logo,
 count(distinct q.id)::int as question_count,
 count(distinct q.id) filter(where q.difficulty='easy')::int as easy_count,
 count(distinct q.id) filter(where q.difficulty='medium')::int as medium_count,
 count(distinct q.id) filter(where q.difficulty='hard')::int as hard_count
 from public.companies c join public.company_question_observations o on o.company_id=c.id
 left join ${practiceQuestionsSql} q on q.id=o.question_id and q.is_listed
 group by c.id,c.slug,c.name order by lower(c.name),c.slug`;
export const companySolvedCountsSql = `select o.company_id as id,count(distinct o.question_id)::int as solved_count
 from public.user_question_state u
 join public.company_question_observations o on o.question_id=u.question_id
 join ${practiceQuestionsSql} q on q.id=u.question_id and q.is_listed
 where u.user_id=private.student_id() and u.status='solved' group by o.company_id`;

export async function companyMetadata(client, slug) {
  const row = (
    await client.query(
      `select c.id,c.slug,c.name,
     coalesce((select jsonb_agg(w.time_window order by w.time_window) from
       (select distinct time_window from public.company_question_observations where company_id=c.id) w),'[]'::jsonb) available,
     coalesce((select jsonb_agg(t order by t.uses desc,t.name) from
       (select tp.slug,tp.name,count(distinct qt.question_id)::int as uses
        from public.question_topics qt join public.topics tp on tp.id=qt.topic_id
        join public.company_question_observations o on o.question_id=qt.question_id
        join ${practiceQuestionsSql} q on q.id=qt.question_id and q.is_listed
        where o.company_id=c.id group by tp.slug,tp.name) t),'[]'::jsonb) topics
     from public.companies c where c.slug=$1 and exists(select 1 from public.company_question_observations o where o.company_id=c.id)`,
      [slug],
    )
  ).rows[0];
  if (!row) return null;
  return {
    company: { id: row.id, slug: row.slug, name: row.name },
    available: row.available,
    topics: row.topics,
  };
}

export async function companySheet(
  client,
  slug,
  filters,
  loadMetadata = companyMetadata,
) {
  const metadata = await loadMetadata(client, slug);
  if (!metadata) return null;
  const args = [metadata.company.id, filters.window];
  const add = (value) => {
    args.push(value);
    return "$" + args.length;
  };
  const where = ["q.is_listed"];
  if (filters.difficulty) where.push("q.difficulty=" + add(filters.difficulty));
  if (filters.q)
    where.push("strpos(lower(q.title),lower(" + add(filters.q) + "))>0");
  if (filters.minFrequency != null)
    where.push("o.frequency >= " + add(filters.minFrequency));
  if (filters.minAcceptance != null)
    where.push("o.acceptance >= " + add(filters.minAcceptance));
  if (filters.topics?.length)
    where.push(
      "exists(select 1 from public.question_topics qt join public.topics t on t.id=qt.topic_id where qt.question_id=q.id and t.slug in (" +
        filters.topics.map(add).join(",") +
        "))",
    );
  if (filters.progress === "solved") where.push("own.status='solved'");
  if (filters.progress === "attempted") where.push("own.status='attempted'");
  if (filters.progress === "not-started")
    where.push("coalesce(own.status,'not_started')='not_started'");
  if (filters.progress === "revision")
    where.push("own.next_revision_at is not null");
  const order =
    orderSql(filters.order, {
      title: ["lower(q.title)"],
      difficulty: [difficultyExpression],
      frequency: ["q.frequency"],
      acceptance: ["q.acceptance"],
      revision: revisionExpressions("q"),
    }) ||
    (filters.sort === "title"
      ? "lower(q.title),q.id"
      : filters.sort === "title-desc"
        ? "lower(q.title) desc,q.id"
        : filters.sort === "acceptance-desc"
          ? "q.acceptance desc nulls last,lower(q.title),q.id"
          : filters.sort === "frequency-asc"
            ? "q.frequency asc nulls last,lower(q.title),q.id"
            : "q.frequency desc nulls last,lower(q.title),q.id");
  const requestedPage = add(filters.page);
  // One snapshot supplies filtered counts, the clamped page and its rows. State
  // is joined once; note content and tag arrays are read only for the 50 page rows.
  const summary = (
    await client.query(
      `with filtered as materialized (
       select q.id,q.title,q.canonical_url,q.original_url,q.difficulty,q.practice_platform as platform,
        o.frequency::float8 frequency,o.acceptance::float8 acceptance,
        coalesce(own.status,'not_started') status,coalesce(own.bookmarked,false) bookmarked,
        own.next_revision_at,own.confidence
       from ${practiceQuestionsSql} q
       join (select question_id,max(frequency) frequency,max(acceptance_percent) acceptance
         from public.company_question_observations where company_id=$1 and time_window=$2
         and frequency_kind in ('percent','unknown') group by question_id) o on o.question_id=q.id
       left join public.user_question_state own on own.question_id=q.id and own.user_id=private.student_id()
       where ${where.join(" and ")}
     ), summary as (
       select count(*)::int as total,count(*) filter(where status='solved')::int solved,
        count(*) filter(where difficulty='easy')::int easy_count,
        count(*) filter(where difficulty='medium')::int medium_count,
        count(*) filter(where difficulty='hard')::int hard_count from filtered
     ), pagination as (
       select least(${requestedPage}::int,greatest(1,ceil(total/50.0)::int)) page,
        greatest(1,ceil(total/50.0)::int) pages from summary
     ), page_rows as (
       select q.*,row_number() over(order by ${order}) ordinal from filtered q
       order by ${order} limit 50 offset (select (page-1)*50 from pagination)
     )
     select summary.*,pagination.*,
      coalesce((select jsonb_agg(to_jsonb(display)-'ordinal' order by display.ordinal) from (
        select q.id,q.title,q.canonical_url,q.original_url,q.difficulty,q.platform,q.frequency,q.acceptance,
         q.status,q.bookmarked,q.next_revision_at is not null revision,q.confidence revision_confidence,q.ordinal,
         exists(select 1 from public.notes n where n.question_id=q.id and n.user_id=private.student_id()) has_note,
         coalesce((select jsonb_agg(jsonb_build_object('slug',p.slug,'name',p.name) order by p.name)
           from public.question_patterns qp join public.patterns p on p.id=qp.pattern_id
           where qp.question_id=q.id and qp.reviewed),'[]'::jsonb) patterns,
         coalesce((select jsonb_agg(t order by t.name) from (select tp.slug,tp.name
           from public.question_topics qt join public.topics tp on tp.id=qt.topic_id where qt.question_id=q.id) t),'[]'::jsonb) topics,
         coalesce((select jsonb_agg(t order by t.frequency desc nulls last,t.name) from
           (select c.slug,c.name,max(x.frequency)::float8 frequency from public.company_question_observations x
            join public.companies c on c.id=x.company_id where x.question_id=q.id and x.time_window=$2
            and x.frequency_kind in ('percent','unknown') group by c.slug,c.name) t),'[]'::jsonb) companies
        from page_rows q) display),'[]'::jsonb) rows
     from summary cross join pagination`,
      args,
    )
  ).rows[0];
  return {
    ...metadata,
    ...summary,
    rows: decorateRoadmapQuestions(summary.rows),
  };
}

// A single private note, read when its editor opens. RLS scopes both the question
// visibility and the note ownership to the caller, so this returns "" for anyone
// else's question or a question the caller may not see.
export async function questionNote(client, questionId) {
  if (!/^[0-9a-f-]{1,100}$/i.test(questionId ?? "")) return "";
  const { rows } = await client.query(
    `select coalesce((select content from public.notes n where n.question_id=q.id),'') as note
     from public.questions q where q.id=$1 and q.is_listed`,
    [questionId],
  );
  return rows[0]?.note ?? "";
}
