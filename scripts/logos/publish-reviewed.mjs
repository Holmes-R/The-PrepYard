// Publish only the reviewed local manifest; never guess domains or overwrite supplied artwork.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import pg from "pg";
const assetRoot = new URL(
  "../../assets/company-logos-verified/",
  import.meta.url,
);
export async function publishReviewedLogos(client) {
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", assetRoot), "utf8"),
  );
  const rows = [];
  const seen = new Set();
  for (const entry of manifest.logos) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug) || seen.has(entry.slug))
      throw new Error("Invalid or duplicate company mapping");
    seen.add(entry.slug);
    if (![".png", ".svg", ".ico", ".webp"].includes(entry.extension))
      throw new Error("Invalid logo file extension");
    const image = await readFile(
      new URL(entry.slug + entry.extension, assetRoot),
    );
    if (
      image.length < 32 ||
      image.length > 262144 ||
      createHash("sha256").update(image).digest("hex") !== entry.sha256
    )
      throw new Error("Logo integrity failure: " + entry.slug);
    rows.push({
      ...entry,
      image: image.toString("hex"),
      source: entry.source.slice(0, 200),
      attribution: (
        entry.evidence +
        " Website: " +
        (entry.website ?? entry.source)
      ).slice(0, 2000),
    });
  }
  await client.query("begin");
  try {
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('company-logos',0))",
    );
    const companies = (
      await client.query("select slug,name from public.companies")
    ).rows;
    for (const row of rows)
      if (!companies.some((c) => c.slug === row.slug && c.name === row.name))
        throw new Error("Company identity mismatch: " + row.slug);
    const published = await client.query(
      `insert into public.company_logos(company_id,content_type,image,sha256,source,attribution)
   select c.id,p.content_type,decode(p.image,'hex'),p.sha256,p.source,p.attribution from jsonb_to_recordset($1::jsonb) as p(slug text,content_type text,image text,sha256 text,source text,attribution text) join public.companies c on c.slug=p.slug
   on conflict(company_id) do update set content_type=excluded.content_type,image=excluded.image,sha256=excluded.sha256,source=excluded.source,attribution=excluded.attribution
   where company_logos.source not like 'local:%' and (company_logos.sha256<>excluded.sha256 or company_logos.source<>excluded.source)`,
      [JSON.stringify(rows)],
    );
    const total = (
      await client.query("select count(*)::int n from public.company_logos")
    ).rows[0].n;
    await client.query("commit");
    return {
      reviewed: rows.length,
      changed: published.rowCount,
      attached: total,
      companies: companies.length,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
if (
  process.argv[1] &&
  new URL(import.meta.url).pathname.endsWith(
    process.argv[1].replace(/\\/g, "/").split("/").pop(),
  )
) {
  if (!process.env.IMPORT_DATABASE_URL)
    throw new Error("Set IMPORT_DATABASE_URL to the administrator connection.");
  const client = new pg.Client({
    connectionString: process.env.IMPORT_DATABASE_URL,
  });
  try {
    await client.connect();
    console.log(await publishReviewedLogos(client));
  } finally {
    await client.end();
  }
}
