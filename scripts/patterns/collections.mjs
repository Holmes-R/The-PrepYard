import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { topics, topicFor, generalPatterns, patternSlug } from "./taxonomy.mjs";

export function validateCollections(manifest) {
  if (
    manifest.version !== 1 ||
    !Array.isArray(manifest.collections) ||
    !manifest.collections.length
  )
    throw new Error("Invalid collection manifest");
  const slugs = new Set();
  for (const sheet of manifest.collections) {
    if (
      !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(sheet.slug) ||
      slugs.has(sheet.slug) ||
      typeof sheet.name !== "string" ||
      !sheet.name.trim() ||
      sheet.name.length > 200
    )
      throw new Error("Invalid collection identity");
    slugs.add(sheet.slug);
    if (
      !Number.isInteger(sheet.expectedCount) ||
      sheet.expectedCount < 1 ||
      sheet.questions?.length !== sheet.expectedCount
    )
      throw new Error("Collection count mismatch: " + sheet.slug);
    const ids = new Set(),
      urls = new Set();
    for (const q of sheet.questions) {
      const url = new URL(q.url);
      const expected =
        q.platform === "leetcode"
          ? "leetcode.com"
          : q.platform === "takeuforward"
            ? "takeuforward.org"
            : null;
      if (
        !expected ||
        url.protocol !== "https:" ||
        url.hostname !== expected ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash
      )
        throw new Error("Invalid platform URL");
      if (
        !url.pathname.startsWith(
          q.platform === "leetcode" ? "/problems/" : "/practice/dsa/",
        )
      )
        throw new Error("Invalid problem path");
      if (
        !/^\d+$/.test(q.externalId) ||
        !q.title?.trim() ||
        q.title.length > 500 ||
        ![null, "easy", "medium", "hard"].includes(q.difficulty) ||
        !topics.some(([slug]) => slug === q.topic)
      )
        throw new Error("Invalid question metadata");
      if (
        q.patterns?.some(
          (name) =>
            typeof name !== "string" || !name.trim() || name.length > 200,
        )
      )
        throw new Error("Invalid pattern");
      const key = q.platform + ":" + q.externalId;
      if (ids.has(key) || urls.has(q.url))
        throw new Error("Duplicate collection question");
      ids.add(key);
      urls.add(q.url);
    }
  }
  return manifest.collections;
}
export async function publishCollections(client, input) {
  const manifest =
    input ??
    JSON.parse(
      await readFile(new URL("./collections.json", import.meta.url), "utf8"),
    );
  const sheets = validateCollections(manifest);
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
          "insert into public.dsa_topics(slug,name,position) values($1,$2,$3) on conflict(slug) do update set name=excluded.name returning id",
          [slug, name, position],
        )
      ).rows[0];
      topicIds.set(slug, row.id);
    }
    const platformIds = new Map();
    for (const [slug, name, base] of [
      ["leetcode", "LeetCode", "https://leetcode.com"],
      ["takeuforward", "takeUforward", "https://takeuforward.org"],
    ]) {
      const row = (
        await client.query(
          "insert into public.platforms(slug,name,base_url) values($1,$2,$3) on conflict(slug) do update set name=excluded.name returning id",
          [slug, name, base],
        )
      ).rows[0];
      platformIds.set(slug, row.id);
    }
    const existing = (
      await client.query(
        "select id,platform_id,external_id,canonical_url from public.questions",
      )
    ).rows;
    const byIdentity = new Map(
      existing
        .filter((q) => q.external_id)
        .map((q) => [q.platform_id + ":" + q.external_id, q]),
    );
    const normal = (url) => url.replace(/\/$/, "");
    const byUrl = new Map(existing.map((q) => [normal(q.canonical_url), q]));
    const assigned = new Set(
      (
        await client.query("select question_id from public.question_dsa_topics")
      ).rows.map((q) => q.question_id),
    );
    const patterns = new Map(
      (await client.query("select id,slug from public.patterns")).rows.map(
        (p) => [p.slug, p.id],
      ),
    );
    const summaries = [];
    for (const sheet of sheets) {
      const collection = (
        await client.query(
          "insert into public.pattern_collections(slug,name) values($1,$2) on conflict(slug) do update set name=excluded.name returning id",
          [sheet.slug, sheet.name],
        )
      ).rows[0];
      const items = [];
      for (const [position, q] of sheet.questions.entries()) {
        const platformId = platformIds.get(q.platform);
        const key = platformId + ":" + q.externalId;
        let row = byIdentity.get(key) ?? byUrl.get(normal(q.url));
        if (
          row &&
          (row.platform_id !== platformId ||
            (row.external_id && row.external_id !== q.externalId))
        )
          throw new Error("Conflicting question identity");
        if (!row) {
          row = (
            await client.query(
              "insert into public.questions(platform_id,external_id,canonical_url,title,difficulty,is_listed) values($1,$2,$3,$4,$5,true) returning id,platform_id,external_id,canonical_url",
              [platformId, q.externalId, q.url, q.title, q.difficulty],
            )
          ).rows[0];
          byIdentity.set(key, row);
          byUrl.set(normal(q.url), row);
        } else
          await client.query(
            "update public.questions set is_listed=true,difficulty=coalesce(difficulty,$2) where id=$1 and (not is_listed or (difficulty is null and $2::text is not null))",
            [row.id, q.difficulty],
          );
        if (!assigned.has(row.id)) {
          const tags =
            q.platform === "leetcode"
              ? (catalogue[q.externalId]?.topics ?? []).map((t) => t.slug)
              : [];
          const topic = tags.length ? topicFor(tags) : q.topic;
          await client.query(
            "insert into public.question_dsa_topics(question_id,topic_id) values($1,$2) on conflict(question_id) do nothing",
            [row.id, topicIds.get(topic)],
          );
          const names = [
            ...new Set([
              ...(q.patterns ?? []),
              ...generalPatterns
                .filter(([tag]) => tags.includes(tag))
                .map(([, name]) => name),
            ]),
          ];
          for (const name of names) {
            const slug = patternSlug(name);
            let id = patterns.get(slug);
            if (!id) {
              id = (
                await client.query(
                  "insert into public.patterns(slug,name) values($1,$2) on conflict(slug) do update set name=excluded.name returning id",
                  [slug, name],
                )
              ).rows[0].id;
              patterns.set(slug, id);
            }
            await client.query(
              "insert into public.question_patterns(question_id,pattern_id,mapping_source,reviewed) values($1,$2,'prepyard-collections-v1',true) on conflict(question_id,pattern_id) do nothing",
              [row.id, id],
            );
          }
          assigned.add(row.id);
        }
        items.push({ question_id: row.id, position });
      }
      if (new Set(items.map((q) => q.question_id)).size !== sheet.expectedCount)
        throw new Error("Resolved collection identity count mismatch");
      // Replace membership only, within this transaction. Canonical questions and student state survive.
      await client.query(
        "delete from public.pattern_collection_questions where collection_id=$1",
        [collection.id],
      );
      await client.query(
        "insert into public.pattern_collection_questions(collection_id,question_id,position) select $1,question_id,position from jsonb_to_recordset($2::jsonb) as x(question_id uuid,position int)",
        [collection.id, JSON.stringify(items)],
      );
      summaries.push({ slug: sheet.slug, questions: items.length });
    }
    await client.query("commit");
    return summaries;
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
    console.log(JSON.stringify(await publishCollections(client)));
  } finally {
    await client.end();
  }
}
