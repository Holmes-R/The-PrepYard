import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { publishCollections } from "./collections.mjs";
import { topics, topicFor, generalPatterns, patternSlug } from "./taxonomy.mjs";

export async function publishPatterns(client) {
  const reference = JSON.parse(
    await readFile(new URL("./kushal-patterns.json", import.meta.url), "utf8"),
  );
  const catalogue = JSON.parse(
    await readFile(
      new URL("../topics/leetcode-topics.json", import.meta.url),
      "utf8",
    ),
  ).questions;
  const bySlug = new Map(
    Object.entries(catalogue).map(([id, q]) => [q.titleSlug, { ...q, id }]),
  );
  const memberships = new Map();
  for (const group of reference.groups)
    for (const slug of group.questions) {
      if (!bySlug.has(slug))
        throw new Error("Missing question metadata: " + slug);
      memberships.set(slug, [...(memberships.get(slug) ?? []), group.name]);
    }
  if (
    memberships.size !== 178 ||
    reference.groups.reduce((n, g) => n + g.questions.length, 0) !== 180
  )
    throw new Error("Reference fixture count mismatch");
  await client.query("begin");
  try {
    await client.query(
      "select pg_advisory_xact_lock(hashtext('prepyard-patterns-v1'))",
    );
    const platform = (
      await client.query(
        "select id from public.platforms where slug='leetcode'",
      )
    ).rows[0];
    if (!platform)
      throw new Error(
        "Import the LeetCode catalogue before publishing the DSA sheet.",
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
    const allNames = [
      ...reference.groups.map((g) => g.name),
      ...generalPatterns.map(([, n]) => n),
      "Sliding Window",
    ];
    for (const [position, name] of [...new Set(allNames)].entries()) {
      const row = (
        await client.query(
          "insert into public.patterns(slug,name,position) values($1,$2,$3) on conflict(slug) do update set name=excluded.name returning id",
          [patternSlug(name), name, position],
        )
      ).rows[0];
      patternIds.set(name, row.id);
    }
    const collection = (
      await client.query(
        "insert into public.pattern_collections(slug,name) values($1,$2) on conflict(slug) do update set name=excluded.name returning id",
        [reference.slug, reference.name],
      )
    ).rows[0];
    // Resolve by platform ID first; use a normalized URL only when external ID is absent.
    const known = (
      await client.query(
        "select id,external_id,canonical_url,is_listed from public.questions where platform_id=$1",
        [platform.id],
      )
    ).rows;
    const questionByExternal = new Map(
      known.filter((q) => q.external_id).map((q) => [q.external_id, q]),
    );
    const questionBySlug = new Map(
      known.map((q) => [
        new URL(q.canonical_url).pathname.split("/").filter(Boolean).at(-1),
        q,
      ]),
    );
    for (const slug of memberships.keys()) {
      const meta = bySlug.get(slug);
      let row = questionByExternal.get(meta.id) ?? questionBySlug.get(slug);
      if (!row) {
        row = (
          await client.query(
            "insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,is_listed) values($1,$2,$3,$4,$5,true) returning id,external_id,canonical_url,is_listed",
            [
              platform.id,
              meta.id,
              "https://leetcode.com/problems/" + slug + "/",
              meta.title,
              reference.easy.includes(slug)
                ? "easy"
                : reference.hard.includes(slug)
                  ? "hard"
                  : "medium",
            ],
          )
        ).rows[0];
        known.push(row);
        questionByExternal.set(meta.id, row);
        questionBySlug.set(slug, row);
      } else if (!row.is_listed) {
        await client.query(
          "update public.questions set is_listed=true where id=$1",
          [row.id],
        );
        row.is_listed = true;
      }
    }
    const assignments = [];
    const mappings = [];
    const items = [];
    for (const row of known.filter((q) => q.is_listed)) {
      const slug = new URL(row.canonical_url).pathname
        .split("/")
        .filter(Boolean)
        .at(-1);
      const meta = catalogue[row.external_id] ?? bySlug.get(slug);
      const groups = memberships.get(slug) ?? [];
      const tags = (meta?.topics ?? []).map((t) => t.slug);
      assignments.push({
        question_id: row.id,
        topic_id: topicIds.get(topicFor(tags, groups)),
      });
      const names = new Set(
        groups.length
          ? groups
          : [
              ...generalPatterns
                .filter(([tag]) => tags.includes(tag))
                .map(([, name]) => name),
            ],
      );
      if (groups.includes("Fixed Size") || groups.includes("Variable Size"))
        names.add("Sliding Window");
      for (const name of names)
        mappings.push({
          question_id: row.id,
          pattern_id: patternIds.get(name),
        });
      if (groups.length)
        items.push({
          question_id: row.id,
          position: [...memberships.keys()].indexOf(slug),
        });
    }
    if (items.length !== 178)
      throw new Error(
        "Collection has missing or duplicate question identities",
      );
    await client.query(
      "insert into public.question_dsa_topics select * from jsonb_to_recordset($1::jsonb) as x(question_id uuid,topic_id uuid) on conflict(question_id) do update set topic_id=excluded.topic_id",
      [JSON.stringify(assignments)],
    );
    await client.query(
      "delete from public.question_patterns where mapping_source='prepyard-patterns-v1'",
    );
    await client.query(
      "insert into public.question_patterns(question_id,pattern_id,mapping_source,reviewed) select question_id,pattern_id,'prepyard-patterns-v1',true from jsonb_to_recordset($1::jsonb) as x(question_id uuid,pattern_id uuid) on conflict(question_id,pattern_id) do update set reviewed=true",
      [JSON.stringify(mappings)],
    );
    await client.query(
      "insert into public.pattern_collection_questions(collection_id,question_id,position) select $1,question_id,position from jsonb_to_recordset($2::jsonb) as x(question_id uuid,position int) on conflict(collection_id,question_id) do update set position=excluded.position",
      [collection.id, JSON.stringify(items)],
    );
    await client.query("commit");
    return {
      topics: topics.length,
      questions: assignments.length,
      collectionQuestions: items.length,
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
        core: await publishPatterns(client),
        collections: await publishCollections(client),
      }),
    );
  } finally {
    await client.end();
  }
}
