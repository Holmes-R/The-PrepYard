const keys = ["title", "difficulty", "revision", "frequency", "acceptance"];
export function parseOrder(raw, allowed = keys) {
  const seen = new Set();
  return (typeof raw === "string" ? raw : "").split(",").flatMap((token) => {
    const match =
      /^(title|difficulty|revision|frequency|acceptance)-(asc|desc)$/.exec(
        token,
      );
    if (
      !match ||
      !allowed.includes(match[1]) ||
      seen.has(match[1]) ||
      seen.size >= 3
    )
      return [];
    seen.add(match[1]);
    return [{ key: match[1], direction: match[2] }];
  });
}
export function cleanOrder(raw, allowed = keys) {
  return parseOrder(raw, allowed)
    .map((s) => s.key + "-" + s.direction)
    .join(",");
}
export function effectiveOrder(order, sort) {
  if (order) return cleanOrder(order);
  if (sort === "title") return "title-asc";
  if (sort === "revision") return "revision-asc";
  return cleanOrder(sort);
}
export function toggleOrder(raw, key) {
  const list = parseOrder(raw),
    index = list.findIndex((s) => s.key === key);
  const first = ["frequency", "acceptance"].includes(key) ? "desc" : "asc";
  if (index < 0) {
    if (list.length === 3) list.pop();
    list.push({ key, direction: first });
  } else if (list[index].direction === first)
    list[index].direction = first === "asc" ? "desc" : "asc";
  else list.splice(index, 1);
  return cleanOrder(list.map((s) => s.key + "-" + s.direction).join(","));
}
// Every SQL expression is fixed here. URL input only selects allowlisted keys/directions.
export function orderSql(raw, expressions) {
  const list = parseOrder(raw, Object.keys(expressions));
  if (!list.length) return "";
  return (
    list
      .map(({ key, direction }) =>
        expressions[key]
          .map((expr) => expr + " " + direction + " nulls last")
          .join(","),
      )
      .join(",") + ",lower(q.title),q.id"
  );
}
export function revisionExpressions(alias = "u") {
  return [
    "case when " +
      alias +
      ".next_revision_at<=now() then 0 when " +
      alias +
      ".confidence in (1,2) then 1 when " +
      alias +
      ".next_revision_at is not null then 2 else 3 end",
    alias + ".confidence",
    alias + ".next_revision_at",
  ];
}
export const difficultyExpression =
  "case q.difficulty when 'easy' then 1 when 'medium' then 2 when 'hard' then 3 end";
