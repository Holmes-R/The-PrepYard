import manifest from "./reviewed-alternatives.json" with { type: "json" };
import access from "./leetcode-access.json" with { type: "json" };

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const platforms = {
  GeeksforGeeks: {
    host: "www.geeksforgeeks.org",
    path: /^\/problems\/[a-z0-9-]+\/1$/,
  },
  HackerRank: {
    host: "www.hackerrank.com",
    path: /^\/challenges\/[a-z0-9-]+\/problem$/,
  },
  CodeChef: { host: "www.codechef.com", path: /^\/problems\/[A-Z0-9_]+$/ },
};

export function validateAlternatives(entries) {
  const seen = new Set();
  for (const item of entries) {
    if (!slugPattern.test(item.source_slug) || seen.has(item.source_slug))
      throw new Error("Invalid or duplicate question mapping");
    seen.add(item.source_slug);
    const platform = platforms[item.platform];
    const url = new URL(item.url);
    if (
      !platform ||
      url.protocol !== "https:" ||
      url.hostname !== platform.host ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !platform.path.test(url.pathname)
    )
      throw new Error(
        "Alternative must point directly to an approved practice judge",
      );
    if (
      !item.title?.trim() ||
      item.title.length > 500 ||
      !["easy", "medium", "hard"].includes(item.difficulty) ||
      item.match !== "equivalent" ||
      item.free_submission !== true ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.reviewed_at) ||
      !item.review_notes?.trim()
    )
      throw new Error("Only reviewed free equivalents can be published");
  }
  return entries;
}

export const reviewedAlternatives = validateAlternatives(manifest.alternatives);
const bySlug = new Map(reviewedAlternatives.map((r) => [r.source_slug, r]));
const paid = new Set(
  access.questions.filter((q) => q.paid_only).map((q) => q.slug),
);

function leetcodeSlug(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "leetcode.com")
      return null;
    return /^\/problems\/([a-z0-9-]+)\/?$/.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

function neetcodeQuestion(question) {
  if (question.platform?.toLowerCase() === "neetcode") return true;
  try {
    const host = new URL(question.canonical_url).hostname;
    return host === "neetcode.io" || host.endsWith(".neetcode.io");
  } catch {
    return false;
  }
}

// Stable IDs continue to own notes/progress. Never overwrite the imported identity.
export function practiceQuestion(question) {
  if (neetcodeQuestion(question)) return null;
  const slug = leetcodeSlug(question.canonical_url);
  const replacement = bySlug.get(slug);
  if (replacement)
    return {
      ...question,
      title: replacement.title,
      canonical_url: replacement.url,
      difficulty: replacement.difficulty,
      platform: replacement.platform,
    };
  return slug && paid.has(slug) ? null : { ...question };
}

// All lists/counts/filters use this relation BEFORE pagination, so hiding an
// unresolved entry never leaves short pages or inaccurate counts. Original URLs
// are used solely for curated pattern membership and removed from API rows.
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";
const records = reviewedAlternatives.map(
  ({ source_slug, title, url, difficulty, platform }) => ({
    source_slug,
    title,
    url,
    difficulty,
    platform,
  }),
);
const paidList = [...paid].sort().map(literal).join(",");
export const practiceQuestionsSql = `(select original.id,original.platform_id,original.external_id,
  original.canonical_url as original_url,
  coalesce(alternative.url,original.canonical_url) as canonical_url,
  coalesce(alternative.title,original.title) as title,
  coalesce(alternative.difficulty,original.difficulty) as difficulty,
  coalesce(alternative.platform,platform.name) as practice_platform,
  original.original_difficulty,original.is_listed,original.created_at,original.updated_at
  from public.questions original
  join public.platforms platform on platform.id=original.platform_id
  left join jsonb_to_recordset(${literal(JSON.stringify(records))}::jsonb)
    as alternative(source_slug text,title text,url text,difficulty text,platform text)
    on platform.slug='leetcode' and alternative.source_slug=split_part(original.canonical_url,'/',5)
  where lower(platform.slug)<>'neetcode' and lower(platform.name)<>'neetcode'
    and original.canonical_url !~* ${literal("^https?://([^/]+\\.)?neetcode\\.io([/:?#]|$)")}
    and (platform.slug<>'leetcode' or split_part(original.canonical_url,'/',5) not in (${paidList})
    or alternative.url is not null))`;

// Existing notes on pending questions remain readable/editable, with no paid link.
export function practiceNote(note) {
  return practiceQuestion(note) ?? { ...note, canonical_url: "" };
}
