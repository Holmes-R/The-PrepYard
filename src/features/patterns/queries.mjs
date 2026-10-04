export function patternFilters(params = {}) {
  const one = (key) => (typeof params[key] === "string" ? params[key] : "");
  const slug = (key) =>
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(one(key)) ? one(key).slice(0, 120) : "";
  return {
    q: one("q").trim().slice(0, 100),
    topic: slug("topic"),
    pattern: slug("pattern"),
    collection: slug("collection"),
    difficulty: ["easy", "medium", "hard"].includes(one("difficulty"))
      ? one("difficulty")
      : "",
    progress: ["solved", "unsolved", "bookmarked", "revision"].includes(
      one("progress"),
    )
      ? one("progress")
      : "",
    sort: ["title", "difficulty"].includes(one("sort"))
      ? one("sort")
      : "recommended",
    page: /^[1-9][0-9]{0,4}$/.test(one("page")) ? Number(one("page")) : 1,
  };
}
function queryParts(f) {
  const args = [];
  const add = (v) => {
    args.push(v);
    return "$" + args.length;
  };
  const where = ["q.is_listed"];
  if (f.q) where.push("strpos(lower(q.title),lower(" + add(f.q) + "))>0");
  if (f.topic) where.push("t.slug=" + add(f.topic));
  if (f.difficulty) where.push("q.difficulty=" + add(f.difficulty));
  if (f.pattern)
    where.push(
      "exists(select 1 from public.question_patterns qp join public.patterns p on p.id=qp.pattern_id where qp.question_id=q.id and qp.reviewed and p.slug=" +
        add(f.pattern) +
        ")",
    );
  if (f.collection)
    where.push(
      "exists(select 1 from public.pattern_collection_questions cq join public.pattern_collections c on c.id=cq.collection_id where cq.question_id=q.id and c.slug=" +
        add(f.collection) +
        ")",
    );
  if (f.progress === "solved") where.push("u.status='solved'");
  if (f.progress === "unsolved")
    where.push("coalesce(u.status,'not_started')<>'solved'");
  if (f.progress === "bookmarked") where.push("u.bookmarked");
  if (f.progress === "revision") where.push("u.next_revision_at is not null");
  return {
    args,
    add,
    base: `from public.questions q join public.question_dsa_topics qt on qt.question_id=q.id join public.dsa_topics t on t.id=qt.topic_id left join public.user_question_state u on u.question_id=q.id and u.user_id=private.student_id() where ${where.join(" and ")}`,
  };
}
export async function patternOverview(client, f) {
  const { args, base } = queryParts(f);
  const groups = (
    await client.query(
      `select t.slug,t.name,t.position,count(*)::int total,count(*) filter(where u.status='solved')::int solved ${base} group by t.id order by t.position,t.name`,
      args,
    )
  ).rows;
  const topics = (
    await client.query(
      "select slug,name from public.dsa_topics order by position,name",
    )
  ).rows;
  const patterns = (
    await client.query(
      `select p.slug,p.name from public.patterns p where exists(select 1 from public.question_patterns qp join public.question_dsa_topics qt on qt.question_id=qp.question_id where qp.pattern_id=p.id and qp.reviewed) order by p.name`,
    )
  ).rows;
  const collections = (
    await client.query(
      "select slug,name from public.pattern_collections order by name",
    )
  ).rows;
  return {
    groups,
    topics,
    patterns,
    collections,
    total: groups.reduce((n, g) => n + g.total, 0),
    solved: groups.reduce((n, g) => n + g.solved, 0),
  };
}
export async function patternQuestions(client, f) {
  const { args, base, add } = queryParts(f);
  const summary = (
    await client.query(
      `select count(*)::int total,count(*) filter(where u.status='solved')::int solved ${base}`,
      args,
    )
  ).rows[0];
  const pages = Math.max(1, Math.ceil(summary.total / 30));
  const page = Math.min(f.page, pages);
  const collectionOrder =
    f.collection && f.sort === "recommended"
      ? "coalesce((select cq.position from public.pattern_collection_questions cq join public.pattern_collections pc on pc.id=cq.collection_id where cq.question_id=q.id and pc.slug=" +
        add(f.collection) +
        "),2147483647)"
      : "coalesce((select min(cq.position) from public.pattern_collection_questions cq where cq.question_id=q.id),2147483647)";
  const order =
    f.sort === "title"
      ? "lower(q.title),q.id"
      : f.sort === "difficulty"
        ? "case q.difficulty when 'easy' then 1 when 'medium' then 2 when 'hard' then 3 else 4 end,lower(q.title),q.id"
        : collectionOrder +
          ",case q.difficulty when 'easy' then 1 when 'medium' then 2 else 3 end,lower(q.title),q.id";
  const rows = (
    await client.query(
      `select q.id,q.title,q.canonical_url,q.difficulty,(select name from public.platforms p where p.id=q.platform_id) platform,
 coalesce(u.status,'not_started') status,coalesce(u.bookmarked,false) bookmarked,u.next_revision_at is not null revision,
 coalesce((select content from public.notes n where n.question_id=q.id and n.user_id=private.student_id()),'') note,
 coalesce((select jsonb_agg(jsonb_build_object('slug',p.slug,'name',p.name) order by p.name) from public.question_patterns qp join public.patterns p on p.id=qp.pattern_id where qp.question_id=q.id and qp.reviewed),'[]'::jsonb) patterns
 ${base} order by ${order} limit 30 offset ${add((page - 1) * 30)}`,
      args,
    )
  ).rows;
  return { ...summary, rows, page, pages };
}
