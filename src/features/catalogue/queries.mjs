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
export function filtersFrom(params = {}) {
  const one = (k) => (typeof params[k] === "string" ? params[k] : "");
  return {
    q: one("q").trim().slice(0, 100),
    difficulty: ["easy", "medium", "hard"].includes(one("difficulty"))
      ? one("difficulty")
      : "",
    window: Object.hasOwn(windowLabels, one("window")) ? one("window") : "all",
    sort: ["frequency-asc", "title"].includes(one("sort"))
      ? one("sort")
      : "frequency-desc",
    page: /^[1-9][0-9]{0,3}$/.test(one("page")) ? Number(one("page")) : 1,
  };
}
export const companiesSql = `select c.slug,c.name,count(distinct o.question_id)::int as question_count,count(distinct o.question_id) filter(where u.status='solved')::int as solved_count from public.companies c join public.company_question_observations o on o.company_id=c.id left join public.user_question_state u on u.question_id=o.question_id group by c.id,c.slug,c.name order by lower(c.name),c.slug`;
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
  // One comparable metric and window per row. Multiple active observations use the highest reported percentage, never a sum.
  const base = `from public.questions q join public.platforms p on p.id=q.platform_id join (select question_id,max(frequency) as frequency from public.company_question_observations where company_id=$1 and time_window=$2 and frequency_kind in ('percent','unknown') group by question_id) o on o.question_id=q.id where ($3='' or q.difficulty=$3) and ($4='' or strpos(lower(q.title),lower($4))>0)`;
  const args = [company.id, filters.window, filters.difficulty, filters.q];
  const total = Number(
    (await client.query("select count(*) as total " + base, args)).rows[0]
      .total,
  );
  const pages = Math.max(1, Math.ceil(total / 50));
  const page = Math.min(filters.page, pages);
  const order =
    filters.sort === "title"
      ? "lower(q.title),q.id"
      : filters.sort === "frequency-asc"
        ? "o.frequency asc nulls last,lower(q.title),q.id"
        : "o.frequency desc nulls last,lower(q.title),q.id";
  const rows = (
    await client.query(
      `select q.id,q.title,q.canonical_url,q.difficulty,p.name as platform,o.frequency::float8 as frequency,
 coalesce((select status from public.user_question_state u where u.question_id=q.id),'not_started') as status,
 coalesce((select bookmarked from public.user_question_state u where u.question_id=q.id),false) as bookmarked,
 (select next_revision_at from public.user_question_state u where u.question_id=q.id) is not null as revision,
 coalesce((select content from public.notes n where n.question_id=q.id),'') as note,
 coalesce((select jsonb_agg(t order by t.frequency desc nulls last,t.name) from (select c.slug,c.name,max(x.frequency)::float8 as frequency from public.company_question_observations x join public.companies c on c.id=x.company_id where x.question_id=q.id and x.time_window=$2 and x.frequency_kind in ('percent','unknown') group by c.slug,c.name) t),'[]'::jsonb) as companies ` +
        base +
        " order by " +
        order +
        " limit 50 offset $5",
      [...args, (page - 1) * 50],
    )
  ).rows;
  const solved = Number(
    (
      await client.query(
        "select count(*) as n " +
          base +
          " and exists(select 1 from public.user_question_state u where u.question_id=q.id and u.status='solved')",
        args,
      )
    ).rows[0].n,
  );
  return { company, available, rows, total, page, pages, solved };
}
