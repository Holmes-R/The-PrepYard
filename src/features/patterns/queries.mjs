import {
  roadmapChoices,
  canonicalPatternSlug,
  roadmapPredicate,
  roadmapRecommendedOrder,
  decorateRoadmapQuestions,
} from "./roadmap.mjs";
import {
  cleanOrder,
  orderSql,
  revisionExpressions,
  difficultyExpression,
} from "../questions/sorting.mjs";
import { prepYardCollectionSlugs, hotlistSlug } from "./collections.mjs";
export function patternFilters(params = {}) {
  const one = (key) => (typeof params[key] === "string" ? params[key] : "");
  const slug = (key) =>
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(one(key)) ? one(key).slice(0, 120) : "";
  const term = one("q").trim().slice(0, 100);
  return {
    q: term,
    topic: slug("topic"),
    pattern: canonicalPatternSlug(slug("pattern")),
    collection: prepYardCollectionSlugs.includes(slug("collection"))
      ? slug("collection")
      : "",
    difficulty: ["easy", "medium", "hard"].includes(one("difficulty"))
      ? one("difficulty")
      : "",
    progress: ["solved", "unsolved", "bookmarked"].includes(one("progress"))
      ? one("progress")
      : "",
    sort: ["random", "difficulty-asc", "difficulty-desc", "revision"].includes(
      one("sort"),
    )
      ? one("sort")
      : "recommended",
    order: cleanOrder(one("order"), ["title", "difficulty", "revision"]),
    // A view preference, but kept in the URL so it survives a filter change and can
    // be bookmarked, like everything else on this page.
    hideTopics: one("hideTopics") === "1" ? "1" : "",
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
  if (f.q) {
    // The field is offered as "filter problems or topics", so a topic name matches
    // too. An exists() rather than a join, because a question has exactly one primary
    // topic here and joining on any other topic's name would duplicate rows.
    const needle = add(f.q);
    where.push(
      "(strpos(lower(q.title),lower(" +
        needle +
        "))>0 or exists(select 1 from public.question_dsa_topics qt2 join public.dsa_topics t2 on t2.id=qt2.topic_id where qt2.question_id=q.id and strpos(lower(t2.name),lower(" +
        needle +
        "))>0))",
    );
  }
  if (f.topic) where.push("t.slug=" + add(f.topic));
  if (f.difficulty) where.push("q.difficulty=" + add(f.difficulty));
  if (f.pattern)
    where.push(
      roadmapPredicate(f.pattern, add) ||
        "exists(select 1 from public.question_patterns qp join public.patterns p on p.id=qp.pattern_id where qp.question_id=q.id and qp.reviewed and p.slug=" +
          add(f.pattern) +
          ")",
    );
  if (f.collection && f.collection !== hotlistSlug)
    where.push(
      "exists(select 1 from public.pattern_collection_questions cq join public.pattern_collections c on c.id=cq.collection_id where cq.question_id=q.id and c.slug=" +
        add(f.collection) +
        ")",
    );
  if (f.progress === "solved") where.push("u.status='solved'");
  if (f.progress === "unsolved")
    where.push("coalesce(u.status,'not_started')<>'solved'");
  if (f.progress === "bookmarked") where.push("u.bookmarked");
  return {
    args,
    add,
    base: `from public.questions q ${f.collection === hotlistSlug ? "join public.topic_frequency_questions hot on hot.question_id=q.id" : ""} join public.question_dsa_topics qt on qt.question_id=q.id join public.dsa_topics t on t.id=qt.topic_id left join public.user_question_state u on u.question_id=q.id and u.user_id=private.student_id() where ${where.join(" and ")}`,
  };
}
export async function patternOverview(client, f) {
  const { args, base } = queryParts(f);
  // The topic chips are driven by these groups rather than by a separate topic list,
  // because a chip showing a count for a topic with no matching questions is a lie.
  const groups = (
    await client.query(
      `select t.slug,t.name,t.position,count(*)::int total,count(*) filter(where u.status='solved')::int solved ${base} group by t.id order by t.position,t.name`,
      args,
    )
  ).rows;
  const patterns = roadmapChoices;
  const collections = (
    await client.query(
      "select slug,name from public.pattern_collections where slug=any($1::text[]) order by name",
      [prepYardCollectionSlugs],
    )
  ).rows;
  const picker = queryParts({
    ...f,
    topic: "",
    q: "",
    difficulty: "",
    progress: "",
  });
  const topics = (
    await client.query(
      `select t.slug,t.name,t.position,count(*)::int total ${picker.base} group by t.id order by t.position,t.name`,
      picker.args,
    )
  ).rows;
  return {
    topics,
    groups,
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
  // The collection position is only bound into the recommended order. Building it
  // unconditionally would bind a parameter the shuffle query never references, and
  // PostgreSQL rejects a bind list longer than the statement needs.
  const order =
    orderSql(f.order, {
      title: ["lower(q.title)"],
      difficulty: [difficultyExpression],
      revision: revisionExpressions(),
    }) ||
    (f.sort === "random"
      ? // Re-evaluated per query, so reloading an identical URL really reshuffles.
        "random()"
      : f.sort === "difficulty-asc"
        ? "case q.difficulty when 'easy' then 1 when 'medium' then 2 when 'hard' then 3 else 4 end,lower(q.title),q.id"
        : f.sort === "difficulty-desc"
          ? "case q.difficulty when 'hard' then 1 when 'medium' then 2 when 'easy' then 3 else 4 end,lower(q.title),q.id"
          : f.sort === "revision"
            ? "case when u.next_revision_at<=now() then 0 when u.confidence in (1,2) then 1 when u.next_revision_at is not null then 2 else 3 end,u.confidence asc nulls last,u.next_revision_at asc nulls last,lower(q.title),q.id"
            : f.collection === hotlistSlug
              ? "t.position,hot.position,q.id"
              : f.collection
                ? "coalesce((select cq.position from public.pattern_collection_questions cq join public.pattern_collections pc on pc.id=cq.collection_id where cq.question_id=q.id and pc.slug=" +
                  add(f.collection) +
                  "),2147483647),lower(q.title),q.id"
                : roadmapRecommendedOrder(f.pattern, add) ||
                  "case q.difficulty when 'easy' then 1 when 'medium' then 2 else 3 end,lower(q.title),q.id");
  const rows = (
    await client.query(
      `select ${f.collection === hotlistSlug ? "hot.reported_frequency,hot.company_count," : ""} q.id,q.title,q.canonical_url,q.difficulty,(select name from public.platforms p where p.id=q.platform_id) platform,
 u.confidence revision_confidence,coalesce(u.status,'not_started') status,coalesce(u.bookmarked,false) bookmarked,u.next_revision_at is not null revision,
 exists(select 1 from public.notes n where n.question_id=q.id and n.user_id=private.student_id()) has_note,
 coalesce((select jsonb_agg(jsonb_build_object('slug',p.slug,'name',p.name) order by p.name) from public.question_patterns qp join public.patterns p on p.id=qp.pattern_id where qp.question_id=q.id and qp.reviewed),'[]'::jsonb) patterns,
 coalesce((select jsonb_agg(jsonb_build_object('slug',lt.slug,'name',lt.name) order by lt.name) from public.question_topics lqt join public.topics lt on lt.id=lqt.topic_id where lqt.question_id=q.id),'[]'::jsonb) topics
 ${base} order by ${order} limit 30 offset ${add((page - 1) * 30)}`,
      args,
    )
  ).rows;
  return { ...summary, rows: decorateRoadmapQuestions(rows), page, pages };
}
