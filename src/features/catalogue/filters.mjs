import { cleanOrder } from "../questions/sorting.mjs";
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
    order: cleanOrder(one("order")),
    topics: many("topics"),
    progress: Object.hasOwn(progressLabels, one("progress"))
      ? one("progress")
      : "any",
    minFrequency: percent(one("minFrequency")),
    minAcceptance: percent(one("minAcceptance")),
    page: /^[1-9][0-9]{0,3}$/.test(one("page")) ? Number(one("page")) : 1,
  };
}
export function filtersToParams(filters, openSlug = "") {
  const params = new URLSearchParams();
  if (openSlug) params.set("open", openSlug);
  if (filters.q) params.set("q", filters.q);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  if (filters.window && filters.window !== "all")
    params.set("window", filters.window);
  if (filters.sort && filters.sort !== "frequency-desc")
    params.set("sort", filters.sort);
  if (filters.order) params.set("order", filters.order);
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
