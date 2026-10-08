import manifest from "./roadmap.json" with { type: "json" };
export const roadmapPatterns = manifest.patterns;
export const roadmapChoices = roadmapPatterns.map(
  ({ slug, name, position }) => ({ slug, name, position }),
);
const bySlug = new Map(
  roadmapPatterns.flatMap((p) =>
    [p.slug, ...p.aliases].map((slug) => [slug, p]),
  ),
);
export function roadmapPattern(slug) {
  return bySlug.get(slug) ?? null;
}
export function canonicalPatternSlug(slug) {
  return roadmapPattern(slug)?.slug ?? slug;
}
const normal = (url) =>
  typeof url === "string" ? url.replace(/\/+$/, "") : "";
export function roadmapPredicate(slug, add) {
  const p = roadmapPattern(slug);
  if (!p) return "";
  const clauses = [
    "rtrim(q.canonical_url,'/')=any(" +
      add(p.questions.map((q) => normal(q.url))) +
      "::text[])",
  ];
  if (p.tags.length)
    clauses.push(
      "exists(select 1 from public.question_topics rt join public.topics tag on tag.id=rt.topic_id where rt.question_id=q.id and tag.slug=any(" +
        add(p.tags) +
        "::text[]))",
    );
  clauses.push(
    "exists(select 1 from public.question_patterns rp join public.patterns pattern on pattern.id=rp.pattern_id where rp.question_id=q.id and rp.reviewed and pattern.slug=any(" +
      add([p.slug, ...p.aliases]) +
      "::text[]))",
  );
  return "(" + clauses.join(" or ") + ")";
}
export function roadmapRecommendedOrder(slug, add) {
  const p = roadmapPattern(slug);
  if (!p) return "";
  return (
    "array_position(" +
    add(p.questions.map((q) => normal(q.url))) +
    "::text[],rtrim(q.canonical_url,'/')) asc nulls last,case q.difficulty when 'easy' then 1 when 'medium' then 2 when 'hard' then 3 end asc nulls last,lower(q.title),q.id"
  );
}
export function decorateRoadmapQuestions(rows) {
  return rows.map((q) => {
    const tags = new Set((q.topics ?? []).map((t) => t.slug));
    const url = normal(q.canonical_url);
    const old = (q.patterns ?? []).map((p) => {
      const definition = roadmapPattern(p.slug);
      return definition ? { slug: definition.slug, name: definition.name } : p;
    });
    const matched = roadmapPatterns
      .filter(
        (p) =>
          p.tags.some((t) => tags.has(t)) ||
          p.questions.some((item) => normal(item.url) === url),
      )
      .map((p) => ({ slug: p.slug, name: p.name }));
    const patterns = [
      ...new Map([...matched, ...old].map((p) => [p.slug, p])).values(),
    ].sort(
      (a, b) =>
        (roadmapPattern(a.slug)?.position ?? 999) -
          (roadmapPattern(b.slug)?.position ?? 999) ||
        a.name.localeCompare(b.name),
    );
    return { ...q, patterns };
  });
}
