// Stores one brand mark per company in public.company_logos.
//
// Logos live in the database rather than being hot-linked so a card never renders a
// broken image or calls a third party at page load. Absence is normal: the
// directory falls back to a generated monogram, so this script is allowed to skip a
// company and keeps going.
//
//   node scripts/logos/fetch.mjs                     # the vendored marks (default)
//   node scripts/logos/fetch.mjs --slug adobe        # one company
//   node scripts/logos/fetch.mjs --from ./logos      # a different directory
//   node scripts/logos/fetch.mjs --favicons          # fill gaps from favicons
//   node scripts/logos/fetch.mjs --favicons --guess  # also guess domains (may misattribute)
//   node scripts/logos/fetch.mjs --dry-run           # report, write nothing
//
// Needs IMPORT_DATABASE_URL because logos are operator-supplied brand assets.
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const root = fileURLToPath(new URL("../../", import.meta.url));
const argv = process.argv.slice(2);
const value = (flag) => {
  const at = argv.indexOf(flag);
  return at === -1 ? "" : (argv[at + 1] ?? "");
};
const only = value("--slug")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// assets/company-logos is vendored by scripts/logos/vendor.mjs and holds the real
// brand artwork. Pass --from "" to ignore it.
const fromDir = argv.includes("--from")
  ? value("--from")
  : "assets/company-logos";
const dryRun = argv.includes("--dry-run");
// Favicons are a fallback, not artwork. Off unless asked for.
const favicons = argv.includes("--favicons");
// Off by default on purpose. A slug is not a domain, and guessing attaches real
// other companies' marks: "goldman" resolves to goldman.io, a different business.
// A wrong logo is worse than a monogram, so guessing has to be asked for.
const guess = argv.includes("--guess");

const ENDPOINT = "https://www.google.com/s2/favicons";
const SERVICE = "google-favicon-service";
const SOURCE = `${SERVICE} sz=128`;
const MAX_BYTES = 262144;
const CONCURRENCY = 4;
// public.company_logos only accepts these, so anything else is skipped rather than
// failing the whole run. The favicon service will happily return image/jpeg.
const ALLOWED = new Set([
  "image/png",
  "image/svg+xml",
  "image/webp",
  "image/x-icon",
]);

// The favicon service needs a domain, and a company slug is not a domain. These are
// the ones worth a real mark; anything not listed falls through to the guessed
// candidates below and then, failing that, keeps its monogram.
const DOMAINS = {
  "1kosmos": "1kosmos.ai",
  "6sense": "6sense.com",
  accenture: "accenture.com",
  ackolite: "ack-lite.com",
  acorns: "acorns.com",
  activision: "activision.com",
  adobe: "adobe.com",
  adp: "adp.com",
  aetion: "aetion.com",
  affirm: "affirm.com",
  agoda: "agoda.com",
  airbnb: "airbnb.com",
  airbus: "airbus.com",
  airtel: "airtel.in",
  airwallex: "airwallex.com",
  akamai: "akamai.com",
  "akuna-capital": "akuna.com",
  alibaba: "alibaba.com",
  alicorp: "alicorp.com",
  allbirds: "allbirds.com",
  almostgo: "almostgo.co",
  alphago: "alphago.com",
  amazon: "amazon.com",
  amex: "americanexpress.com",
  analogue: "analogue.com",
  anduril: "anduril.com",
  ansys: "ansys.com",
  anthropic: "anthropic.com",
  apple: "apple.com",
  applied: "appliedmaterials.com",
  arm: "arm.com",
  atlassian: "atlasian.com",
  att: "att.com",
  autodesk: "autodesk.com",
  baidu: "baidu.com",
  balancer: "balancer.fi",
  bam: "bam.tech",
  bankofamerica: "bankofamerica.com",
  battle: "battlehack.com",
  bloomberg: "bloomberg.com",
  bloomreach: "bloomreach.com",
  bny: "bny.com",
  booking: "booking.com",
  broad: "broadcom.com",
  buzzfeed: "buzzfeed.com",
  bytedance: "bytedance.com",
  canonical: "canonical.com",
  canva: "canva.com",
  capgemini: "capgemini.com",
  card: "card.com",
  carnegie: "cmu.edu",
  cashfree: "cashfree.com",
  cisco: "cisco.com",
  cloudflare: "cloudflare.com",
  coinbase: "coinbase.com",
  coursera: "coursera.org",
  crm: "crm.com",
  dailypay: "dailypay.com",
  dee: "dee.com",
  "d-e-shaw": "deshaw.com",
  deloitte: "deloitte.com",
  dell: "dell.com",
  deutsche: "db.com",
  devfolio: "devfolio.com",
  dflare: "dflares.com",
  docusign: "docusign.com",
  doordash: "doordash.com",
  dropbox: "dropbox.com",
  duolingo: "duolingo.com",
  ebay: "ebay.com",
  elastic: "elastic.co",
  etsy: "etsy.com",
  expedia: "expedia.com",
  facebook: "facebook.com",
  flipkart: "flipkart.com",
  foursquare: "foursquare.com",
  freshworks: "freshworks.com",
  gemini: "geminitrust.com",
  gitlab: "gitlab.com",
  goldsman: "goldmansachs.com",
  google: "google.com",
  grab: "grab.com",
  grail: "grail.com",
  groupon: "groupon.com",
  gs: "goldmansachs.com",
  hasura: "hasura.io",
  hbo: "hbo.com",
  heroku: "heroku.com",
  hetu: "tencent.com",
  hilti: "hilti.com",
  hpe: "hpe.com",
  hsbc: "hsbc.com",
  hubspot: "hubspot.com",
  ibm: "ibm.com",
  ieee: "ieee.org",
  indigo: "indigo-travel.com",
  infoedge: "infoedge.com",
  infor: "infor.com",
  intel: "intel.com",
  intuit: "intuit.com",
  jio: "jiostar.com",
  jpmorgan: "jpmorganchase.com",
  "jp-morgan": "jpmorganchase.com",
  jupiter: "jupiter.money",
  kraken: "kraken.com",
  lenovo: "lenovo.com",
  linkedin: "linkedin.com",
  lens: "lens.org",
  linear: "linear.app",
  lockheed: "lockheedmartin.com",
  lululemon: "lululemon.com",
  lyft: "lyft.com",
  mail: "mail.ru",
  mcdonalds: "mcdonalds.com",
  medium: "medium.com",
  meta: "meta.com",
  micron: "micron.com",
  microsoft: "microsoft.com",
  miro: "miro.com",
  mongodb: "mongodb.com",
  morgan: "morganstanley.com",
  mui: "mui.com",
  netflix: "netflix.com",
  netsuite: "netsuite.com",
  ni: "ni.com",
  nvidia: "nvidia.com",
  okta: "okta.com",
  openai: "openai.com",
  openphone: "openphone.com",
  oracle: "oracle.com",
  philo: "philo.com",
  phonepe: "phonepe.com",
  pin: "pinch.com",
  pinterest: "pinterest.com",
  postman: "postman.com",
  pwc: "pwc.com",
  qualcomm: "qualcomm.com",
  quant: "quanta.com",
  quickbooks: "quickbooks.intuit.com",
  ray: "ray.io",
  razorpay: "razorpay.com",
  robinhood: "robinhood.com",
  room: "room.com",
  salesforce: "salesforce.com",
  sap: "sap.com",
  scale: "scaleai.com",
  segment: "segment.com",
  shopify: "shopify.com",
  slack: "slack.com",
  snowflake: "snowflake.com",
  soflo: "soflowa.com",
  sony: "sony.com",
  samsung: "samsung.com",
  stripe: "stripe.com",
  swiggy: "swiggy.com",
  tcs: "tcs.com",
  tesla: "tesla.com",
  tiktok: "tiktok.com",
  twilio: "twilio.com",
  uber: "uber.com",
  ukg: "ukg.com",
  unity: "unity.com",
  vmware: "vmware.com",
  walmart: "walmart.com",
  wayfair: "wayfair.com",
  wise: "wise.com",
  workday: "workday.com",
  x: "x.com",
  yahoo: "yahoo.com",
  yandex: "yandex.com",
  yelp: "yelp.com",
  zebra: "zebra.com",
  zetwerk: "zetwerk.com",
  zoho: "zoho.com",
  zscaler: "zscaler.com",
};
const guessed = (slug) => [
  ...new Set([`${slug}.com`, `${slug}.io`, `${slug}.co.in`, `${slug}.ai`]),
];
async function fromNetwork(slug) {
  if (!favicons) return null;
  const mapped = DOMAINS[slug];
  if (!mapped && !guess) return null;
  for (const domain of mapped ? [mapped] : guessed(slug)) {
    const url = `${ENDPOINT}?domain=${encodeURIComponent(domain)}&sz=128`;
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0", accept: "image/*,*/*" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) continue;
      const content_type = (response.headers.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!ALLOWED.has(content_type)) continue;
      const image = Buffer.from(await response.arrayBuffer());
      if (image.byteLength < 32 || image.byteLength > MAX_BYTES) continue;
      return {
        image,
        content_type,
        source: SOURCE,
        attribution: `Favicon fetched from ${domain} via the Google favicon service.`,
      };
    } catch {
      // One unreachable domain is not a reason to abandon the company.
    }
  }
  return null;
}
const LOCAL = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};
async function fromDisk(slug) {
  if (!fromDir) return null;
  for (const [extension, content_type] of Object.entries(LOCAL)) {
    const file = path.resolve(root, fromDir, slug + extension);
    if (!existsSync(file)) continue;
    const image = readFileSync(file);
    if (image.byteLength < 32 || image.byteLength > MAX_BYTES) continue;
    return {
      image,
      content_type,
      source: "local:" + path.basename(file),
      attribution:
        "Vendored brand mark. See assets/company-logos/ATTRIBUTION.md.",
    };
  }
  return null;
}
async function resolve(slug) {
  // A supplied file always wins, so a curated mark is never overwritten by a favicon.
  return (await fromDisk(slug)) ?? (await fromNetwork(slug));
}
// Connected only when something is actually written, so --dry-run can be used to
// audit the curated map without any credential present.
let client = null;
async function db() {
  if (!client) {
    const url = process.env.IMPORT_DATABASE_URL;
    if (!url)
      throw new Error(
        "Set IMPORT_DATABASE_URL to the database administrator connection.",
      );
    client = new pg.Client({ connectionString: url });
    await client.connect();
  }
  return client;
}
async function main() {
  const slugs = only.length
    ? only
    : (
        await (
          await db()
        ).query("select slug from public.companies order by lower(name),slug")
      ).rows.map((r) => r.slug);
  console.log(
    `${slugs.length} companies to consider${only.length ? ` (filtered from the full directory)` : ""}`,
  );
  const stored = [];
  const skipped = [];
  const queue = [...slugs];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let slug = queue.shift(); slug; slug = queue.shift()) {
        const logo = await resolve(slug);
        if (!logo) {
          skipped.push(slug);
          continue;
        }
        stored.push({ slug, ...logo });
      }
    }),
  );
  stored.sort((a, b) => a.slug.localeCompare(b.slug));
  for (const logo of stored)
    console.log(
      `  ${logo.slug.padEnd(24)} ${String(logo.image.byteLength).padStart(7)}B ${logo.content_type}  ${logo.attribution}`,
    );
  console.log(
    `\n${stored.length} marks resolved, ${skipped.length} companies keep their monogram.`,
  );
  if (skipped.length)
    console.log(
      `No mark for: ${skipped.slice(0, 40).join(", ")}${skipped.length > 40 ? `, +${skipped.length - 40} more` : ""}`,
    );
  if (dryRun || !stored.length) {
    console.log("Nothing written.");
    return;
  }
  const connection = await db();
  await connection.query("begin");
  try {
    await connection.query(
      "select pg_advisory_xact_lock(hashtextextended('company-logos',0))",
    );
    // The insert joins on the directory, so a slug that is not in it would be
    // dropped without a word. Name it instead.
    const known = new Set(
      (
        await connection.query(
          "select slug from public.companies where slug=any($1)",
          [stored.map((logo) => logo.slug)],
        )
      ).rows.map((row) => row.slug),
    );
    const unknown = stored
      .map((logo) => logo.slug)
      .filter((slug) => !known.has(slug));
    if (unknown.length) {
      await connection.query("rollback");
      throw new Error(
        `Not in the company directory: ${unknown.slice(0, 10).join(", ")}${unknown.length > 10 ? `, +${unknown.length - 10} more` : ""}`,
      );
    }
    const payload = stored.map((logo) => ({
      slug: logo.slug,
      content_type: logo.content_type,
      image: "\\x" + logo.image.toString("hex"),
      sha256: createHash("sha256").update(logo.image).digest("hex"),
      source: logo.source,
      attribution: logo.attribution,
    }));
    const result = await connection.query(
      `insert into public.company_logos(company_id,content_type,image,sha256,source,attribution)
       select c.id,p.content_type,decode(p.image,'hex'),p.sha256,p.source,p.attribution
       from jsonb_to_recordset($1::jsonb) as p(slug text,content_type text,image text,sha256 text,source text,attribution text)
       join public.companies c on c.slug=p.slug
       on conflict(company_id) do update
         set content_type=excluded.content_type,image=excluded.image,
             sha256=excluded.sha256,source=excluded.source,attribution=excluded.attribution`,
      [JSON.stringify(payload)],
    );
    await connection.query("commit");
    console.log(`Stored ${result.rowCount} marks in public.company_logos.`);
  } catch (error) {
    await connection.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client?.end();
  }
}
await main();
