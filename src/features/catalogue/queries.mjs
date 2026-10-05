export const windowLabels = {
  all: "All time",
  "30d": "Last 30 days",
  "60d": "Last 60 days",
  "90d": "Last 90 days",
  "180d": "Last 6 months",
  "1y": "Last year",
  "2y": "Last 2 years",
  "older-than-180d": "Older than 6 months",
};
// Topic slugs are platform-owned. Only the shape is validated here; unknown slugs
// simply match nothing rather than widening the result set.
export const progressLabels = {
  any: "Any progress",
  "not-started": "Not started",
  attempted: "Attempted",
  solved: "Solved",
  revision: "Needs revision",
};
const percent = (value) =>
  /^\d{1,3}(?:\.\d{1,2})?$/.test(String(value).trim())
    ? Math.min(100, Number(value))
    : null;
export function filtersFrom(params = {}) {
  const one = (k) => (typeof params[k] === "string" ? params[k] : "");
  const many = (k) => {
    const raw = Array.isArray(params[k]) ? params[k] : [params[k]];
    return [
      ...new Set(
        raw
          .filter((v) => typeof v === "string")
          .flatMap((v) => v.split(","))
          .map((v) => v.trim())
          .filter(
            (v) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 100,
          ),
      ),
    ].slice(0, 12);
  };
  return {
    q: one("q").trim().slice(0, 100),
    difficulty: ["easy", "medium", "hard"].includes(one("difficulty"))
      ? one("difficulty")
      : "",
    window: Object.hasOwn(windowLabels, one("window")) ? one("window") : "all",
    sort: ["frequency-asc", "title", "title-desc", "acceptance-desc"].includes(
      one("sort"),
    )
      ? one("sort")
      : "frequency-desc",
    topics: many("topics"),
    progress: Object.hasOwn(progressLabels, one("progress"))
      ? one("progress")
      : "any",
    minFrequency: percent(one("minFrequency")),
    minAcceptance: percent(one("minAcceptance")),
    page: /^[1-9][0-9]{0,3}$/.test(one("page")) ? Number(one("page")) : 1,
  };
}
export const companiesSql = `select c.slug,c.name,exists(select 1 from public.company_logos l where l.company_id=c.id) as has_logo,count(distinct o.question_id)::int as question_count,count(distinct o.question_id) filter(where u.status='solved')::int as solved_count from public.companies c join public.company_question_observations o on o.company_id=c.id left join public.user_question_state u on u.question_id=o.question_id group by c.id,c.slug,c.name order by lower(c.name),c.slug`;
// Serializes applied filters for the address bar, so a filtered sheet is shareable
// and survives reloads. Empty values are omitted so the reader on the other side
// sees the documented defaults; `open` names the expanded company on /companies.
export function filtersToParams(filters, openSlug = "") {
  const params = new URLSearchParams();
  if (openSlug) params.set("open", openSlug);
  if (filters.q) params.set("q", filters.q);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.window && filters.window !== "all")
    params.set("window", filters.window);
  if (filters.sort && filters.sort !== "frequency-desc")
    params.set("sort", filters.sort);
  for (const topic of filters.topics ?? []) params.append("topics", topic);
  if (filters.progress && filters.progress !== "any")
    params.set("progress", filters.progress);
  if (filters.minFrequency != null)
    params.set("minFrequency", String(filters.minFrequency));
  if (filters.minAcceptance != null)
    params.set("minAcceptance", String(filters.minAcceptance));
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}
// Topics the company actually has questions for, most used first. Drives the topic
// filter so it never offers a tag that would return nothing.
export async function companyTopics(client, companyId) {
  return (
    await client.query(
      `select t.slug,t.name,count(*)::int as uses
       from public.question_topics qt
       join public.topics t on t.id=qt.topic_id
       join public.company_question_observations o on o.question_id=qt.question_id
       where o.company_id=$1
       group by t.slug,t.name
       order by count(*) desc,t.name`,
      [companyId],
    )
  ).rows;
}
export async function companySheet(client, slug, filters) {
  const company = (
    await client.query(
      "select c.id,c.slug,c.name from public.companies c where c.slug=$1 and exists(select 1 from public.company_question_observations o where o.company_id=c.id)",
      [slug],
    )
  ).rows[0];
  if (!company) return null;
  const available = (
    await client.query(
      "select distinct time_window from public.company_question_observations where company_id=$1",
      [company.id],
    )
  ).rows.map((r) => r.time_window);
  const topics = await companyTopics(client, company.id);
  // One comparable metric and window per row. Multiple active observations use the highest reported percentage, never a sum.
  const base = `from public.questions q join public.platforms p on p.id=q.platform_id join (select question_id,max(frequency) as frequency,max(acceptance_percent) as acceptance from public.company_question_observations where company_id=$1 and time_window=$2 and frequency_kind in ('percent','unknown') group by question_id) o on o.question_id=q.id`;
  const where = [];
  const args = [company.id, filters.window];
  const add = (value) => {
    args.push(value);
    return "$" + args.length;
  };
  if (filters.difficulty) where.push("q.difficulty=" + add(filters.difficulty));
  if (filters.q)
    where.push("strpos(lower(q.title),lower(" + add(filters.q) + "))>0");
  if (filters.minFrequency != null)
    where.push("o.frequency >= " + add(filters.minFrequency));
  if (filters.minAcceptance != null)
    where.push("o.acceptance >= " + add(filters.minAcceptance));
  if (filters.topics?.length) {
    const list = filters.topics.map((topic) => add(topic)).join(",");
    // Any selected tag matches, which is how people actually browse: "arrays OR dp".
    where.push(
      "exists(select 1 from public.question_topics qt join public.topics t on t.id=qt.topic_id where qt.question_id=q.id and t.slug in (" +
        list +
        "))",
    );
  }
  // Progress reads the caller's own state, so RLS scopes it to the current student.
  if (filters.progress === "solved")
    where.push(
      "exists(select 1 from public.user_question_state u where u.question_id=q.id and u.status='solved')",
    );
  if (filters.progress === "attempted")
    where.push(
      "exists(select 1 from public.user_question_state u where u.question_id=q.id and u.status='attempted')",
    );
  if (filters.progress === "not-started")
    where.push(
      "not exists(select 1 from public.user_question_state u where u.question_id=q.id and u.status<>'not_started')",
    );
  if (filters.progress === "revision")
    where.push(
      "exists(select 1 from public.user_question_state u where u.question_id=q.id and u.next_revision_at is not null)",
    );
  const clause = (...extra) =>
    " where " + [...where, ...extra].filter(Boolean).join(" and ");
  const total = Number(
    (await client.query("select count(*) as total " + base + clause(), args))
      .rows[0].total,
  );
  const pages = Math.max(1, Math.ceil(total / 50));
  const page = Math.min(filters.page, pages);
  const order =
    filters.sort === "title"
      ? "lower(q.title),q.id"
      : filters.sort === "title-desc"
        ? "lower(q.title) desc,q.id"
        : filters.sort === "acceptance-desc"
          ? "o.acceptance desc nulls last,lower(q.title),q.id"
          : filters.sort === "frequency-asc"
            ? "o.frequency asc nulls last,lower(q.title),q.id"
            : "o.frequency desc nulls last,lower(q.title),q.id";
  // Counted before the rows query so the shared parameter list is not extended
  // afterwards: PostgreSQL rejects a bind list longer than the statement needs.
  const solved = Number(
    (
      await client.query(
        "select count(*) as n " +
          base +
          clause(
            "exists(select 1 from public.user_question_state u where u.question_id=q.id and u.status='solved')",
          ),
        args,
      )
    ).rows[0].n,
  );
  const rows = (
    await client.query(
      `select q.id,q.title,q.canonical_url,q.difficulty,p.name as platform,o.frequency::float8 as frequency,o.acceptance::float8 as acceptance,
 coalesce((select status from public.user_question_state u where u.question_id=q.id),'not_started') as status,
 coalesce((select bookmarked from public.user_question_state u where u.question_id=q.id),false) as bookmarked,
 (select next_revision_at from public.user_question_state u where u.question_id=q.id) is not null as revision,
  // Only whether a note exists travels with the list. Full content is up to 50KB
  // per row and the editor is closed, so it is fetched on demand instead.
  exists(select 1 from public.notes n where n.question_id=q.id) as has_note,
 coalesce((select jsonb_agg(jsonb_build_object('slug',p.slug,'name',p.name) order by p.name) from public.question_patterns qp join public.patterns p on p.id=qp.pattern_id where qp.question_id=q.id and qp.reviewed),'[]'::jsonb) as patterns,
 coalesce((select jsonb_agg(t order by t.name) from (select tp.slug,tp.name from public.question_topics qt join public.topics tp on tp.id=qt.topic_id where qt.question_id=q.id) t),'[]'::jsonb) as topics,
 coalesce((select jsonb_agg(t order by t.frequency desc nulls last,t.name) from (select c.slug,c.name,max(x.frequency)::float8 as frequency from public.company_question_observations x join public.companies c on c.id=x.company_id where x.question_id=q.id and x.time_window=$2 and x.frequency_kind in ('percent','unknown') group by c.slug,c.name) t),'[]'::jsonb) as companies ` +
        base +
        clause() +
        " order by " +
        order +
        " limit 50 offset " +
        add((page - 1) * 50),
      args,
    )
  ).rows;
  return { company, available, topics, rows, total, page, pages, solved };
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
