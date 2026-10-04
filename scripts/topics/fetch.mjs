// Publishes LeetCode topic tags for the questions already in the catalogue.
//
// The catalogue is hermetic: questions arrive as hash-pinned CSV and nothing in the
// application ever calls leetcode.com. Topic tags are the one thing the CSV does not
// carry, so this operator script fetches them once, writes a reviewable artifact that
// is committed alongside the code, and only then publishes. Re-running is safe.
//
//   node scripts/topics/fetch.mjs                  # write the artifact only
//   node scripts/topics/fetch.mjs --publish        # also insert, needs IMPORT_DATABASE_URL
//
// LeetCode's public GraphQL endpoint paginates its whole problem set, so this needs
// roughly one request per 50 questions rather than one per question.
import { createHash } from "node:crypto";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const root = fileURLToPath(new URL("../../", import.meta.url));
const artifact = path.join(root, "scripts/topics/leetcode-topics.json");
const publish = process.argv.includes("--publish");
const refresh = process.argv.includes("--refresh");

const PAGE = 100;
const ENDPOINT = "https://leetcode.com/graphql";
const HEADERS = {
  "content-type": "application/json",
  // LeetCode rejects requests with no Referer as cross-site forgery.
  referer: "https://leetcode.com/problemset/",
  "user-agent": "Mozilla/5.0 (compatible; prepyard-topic-import)",
};
// categorySlug and filters are both mandatory, and the paginated payload is
// { totalNum, data } rather than { total, questions }.
const QUERY = `query questionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    totalNum
    data { questionFrontendId titleSlug title topicTags { name slug } }
  }
}`;
async function fetchPage(skip) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      operationName: "questionList",
      query: QUERY,
      // An empty string, not null: a null categorySlug is dropped before the resolver runs.
      variables: { categorySlug: "", limit: PAGE, skip, filters: {} },
    }),
  });
  if (!response.ok)
    throw new Error(`LeetCode returned ${response.status} for skip=${skip}`);
  const payload = await response.json();
  if (payload.errors?.length)
    throw new Error(
      `LeetCode rejected the query: ${payload.errors[0].message}`,
    );
  return payload.data.questionList;
}
async function collect() {
  const questions = {};
  const first = await fetchPage(0);
  const total = first.totalNum;
  console.log(`LeetCode reports ${total} questions`);
  const absorb = (page) => {
    for (const q of page.data ?? []) {
      const slug = String(q.questionFrontendId ?? "").trim();
      if (!/^[0-9]+$/.test(slug)) continue;
      questions[slug] = {
        titleSlug: q.titleSlug,
        title: q.title,
        // Deduplicated so a platform-side rename cannot create a duplicate tag.
        topics: [
          ...new Map(
            (q.topicTags ?? [])
              .filter((t) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t.slug ?? ""))
              .map((t) => [t.slug, { slug: t.slug, name: t.name }]),
          ).values(),
        ].sort((a, b) => a.slug.localeCompare(b.slug)),
      };
    }
  };
  absorb(first);
  for (let skip = PAGE; skip < total; skip += PAGE) {
    absorb(await fetchPage(skip));
    // Deliberately unhurried: this is an operator script, not a hot path.
    await new Promise((r) => setTimeout(r, 400));
    if (skip % 1000 === 0) console.log(`  ${skip}/${total}`);
  }
  return Object.fromEntries(
    Object.entries(questions).sort(([a], [b]) => Number(a) - Number(b)),
  );
}
const fetched = refresh || !existsSync(artifact) ? await collect() : null;
if (fetched) {
  const tagged = Object.values(fetched).filter((q) => q.topics.length).length;
  writeFileSync(
    artifact,
    JSON.stringify(
      {
        source: "leetcode.com/graphql questionList",
        generator: "scripts/topics/fetch.mjs",
        questions: fetched,
      },
      // Compact on purpose: this is a generated dump, and an indented megabyte
      // makes an unreviewable diff.
      null,
      0,
    ) + "\n",
  );
  console.log(
    `Wrote ${Object.keys(fetched).length} questions, ${tagged} with topics, to ${path.relative(root, artifact)}`,
  );
}
if (!publish) {
  console.log("Artifact only. Review it, then re-run with --publish.");
  process.exit(0);
}
const { questions } = JSON.parse(readFileSync(artifact, "utf8"));
const url = process.env.IMPORT_DATABASE_URL;
if (!url)
  throw new Error(
    "Set IMPORT_DATABASE_URL to the database administrator connection.",
  );
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const mapping = [];
  for (const [externalId, question] of Object.entries(questions)) {
    for (const topic of question.topics)
      mapping.push({ external_id: externalId, ...topic });
  }
  // One transaction: a half-applied topic set would silently mislabel questions.
  await client.query("begin");
  await client.query(
    "select pg_advisory_xact_lock(hashtextextended('leetcode-topics',0))",
  );
  await client.query(
    `insert into public.topics(slug,name)
     select distinct on (slug) slug,name from jsonb_to_recordset($1::jsonb) as t(slug text,name text)
     order by slug
     on conflict(slug) do update set name=excluded.name`,
    [JSON.stringify(mapping)],
  );
  const result = await client.query(
    `insert into public.question_topics(question_id,topic_id,source)
     select q.id,t.id,'leetcode.com/graphql questionList'
     from jsonb_to_recordset($1::jsonb) as m(external_id text,slug text,name text)
     join public.questions q on q.external_id=m.external_id
     join public.platforms p on p.id=q.platform_id and p.slug='leetcode'
     join public.topics t on t.slug=m.slug
     on conflict(question_id,topic_id) do nothing`,
    [JSON.stringify(mapping)],
  );
  const published = result.rowCount ?? 0;
  const catalogue = Number(
    (
      await client.query(
        `select count(*)::int as n from public.questions q
         join public.platforms p on p.id=q.platform_id
         where p.slug='leetcode' and q.is_listed`,
      )
    ).rows[0].n,
  );
  const matched = Number(
    (
      await client.query(
        `select count(distinct q.id)::int as n from public.questions q
         join public.platforms p on p.id=q.platform_id
         join public.question_topics qt on qt.question_id=q.id
         where p.slug='leetcode' and q.is_listed`,
      )
    ).rows[0].n,
  );
  await client.query("commit");
  console.log(
    `Published ${published} topic mappings. ${matched}/${catalogue} listed questions now carry at least one tag.`,
  );
  if (matched < catalogue)
    console.log(
      "Some listed questions have no tag. Re-run with --refresh after checking the platform question IDs still match.",
    );
  console.log(
    "digest",
    createHash("sha256")
      .update(readFileSync(artifact))
      .digest("hex")
      .slice(0, 16),
  );
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
