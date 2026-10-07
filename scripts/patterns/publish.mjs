import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { publishCollections } from "./collections.mjs";
import { topics, topicFor, generalPatterns, patternSlug } from "./taxonomy.mjs";

// Classify catalogue questions by standard topics and platform tags. Editorial
// exercise memberships and ordering are attributed separately in collections.json.
export async function publishPatterns(client) {
  const catalogue = JSON.parse(
    await readFile(
      new URL("../topics/leetcode-topics.json", import.meta.url),
      "utf8",
    ),
  ).questions;
  await client.query("begin");
  try {
    await client.query(
      "select pg_advisory_xact_lock(hashtext('prepyard-patterns-v1'))",
    );
    const topicIds = new Map();
    for (const [position, [slug, name]] of topics.entries()) {
      const row = (
        await client.query(
          "insert into public.dsa_topics(slug,name,position) values($1,$2,$3) on conflict(slug) do update set name=excluded.name,position=excluded.position returning id",
          [slug, name, position],
        )
      ).rows[0];
      topicIds.set(slug, row.id);
    }
    const patternIds = new Map();
    for (const [position, [, name]] of generalPatterns.entries()) {
      const row = (
        await client.query(
          "insert into public.patterns(slug,name,position) values($1,$2,$3) on conflict(slug) do update set name=excluded.name returning id",
          [patternSlug(name), name, position],
        )
      ).rows[0];
      patternIds.set(name, row.id);
    }
    const known = (
      await client.query(
        "select q.id,q.external_id,q.canonical_url from public.questions q join public.platforms p on p.id=q.platform_id where q.is_listed and p.slug='leetcode'",
      )
    ).rows;
    const bySlug = new Map(
      Object.values(catalogue).map((q) => [q.titleSlug, q]),
    );
    const assignments = [],
      mappings = [];
    for (const row of known) {
      const slug = new URL(row.canonical_url).pathname
        .split("/")
        .filter(Boolean)
        .at(-1);
      const meta = catalogue[row.external_id] ?? bySlug.get(slug);
      if (!meta) continue;
      const tags = (meta.topics ?? []).map((t) => t.slug);
      assignments.push({
        question_id: row.id,
        topic_id: topicIds.get(topicFor(tags)),
      });
      for (const [tag, name] of generalPatterns)
        if (tags.includes(tag))
          mappings.push({
            question_id: row.id,
            pattern_id: patternIds.get(name),
          });
    }
    await client.query(
      "insert into public.question_dsa_topics select * from jsonb_to_recordset($1::jsonb) as x(question_id uuid,topic_id uuid) on conflict(question_id) do update set topic_id=excluded.topic_id",
      [JSON.stringify(assignments)],
    );
    await client.query(
      "delete from public.question_patterns where mapping_source=any($1::text[])",
      [
        [
          "prepyard-patterns-v1",
          "prepyard-collections-v1",
          "prepyard-topic-tags-v2",
        ],
      ],
    );
    await client.query(
      "insert into public.question_patterns(question_id,pattern_id,mapping_source,reviewed) select question_id,pattern_id,'prepyard-topic-tags-v2',true from jsonb_to_recordset($1::jsonb) as x(question_id uuid,pattern_id uuid) on conflict(question_id,pattern_id) do nothing",
      [JSON.stringify(mappings)],
    );
    await client.query("commit");
    return {
      topics: topics.length,
      questions: assignments.length,
      patternMappings: mappings.length,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.IMPORT_DATABASE_URL)
    throw new Error(
      "Set IMPORT_DATABASE_URL to the administrative database connection.",
    );
  const client = new pg.Client({
    connectionString: process.env.IMPORT_DATABASE_URL,
  });
  try {
    await client.connect();
    console.log(
      JSON.stringify({
        collections: await publishCollections(client),
        core: await publishPatterns(client),
      }),
    );
  } finally {
    await client.end();
  }
}
