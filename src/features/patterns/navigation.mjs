export function patternHref(slug, params = new URLSearchParams()) {
  if (
    typeof slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    slug.length > 120
  )
    throw new Error("Invalid pattern slug");
  const query = new URLSearchParams(params);
  query.delete("pattern");
  return "/patterns/" + slug + (query.size ? "?" + query.toString() : "");
}
