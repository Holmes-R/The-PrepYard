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
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
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
// Reads the company list from the import snapshot instead of the database, so
// coverage can be audited offline. Audit only: writing still needs the database.
const fromSnapshot = argv.includes("--snapshot");
// Marks the favicon layer refused after review, so a re-run does not put a known-wrong
// logo back. The workflow is: run, read the review list, --reject the bad ones, re-run.
const rejecting = value("--reject")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// Favicons are a fallback, not artwork. Off unless asked for.
const favicons = argv.includes("--favicons");
// Every candidate domain must be vouched for by the site itself. On by default
// because that is the whole point of --favicons; --no-verify stores whatever the
// service returns, which is how aurora.com ends up as Aurora's mark.
const verify = favicons && !argv.includes("--no-verify");
// Off by default on purpose. A slug is not a domain, and guessing attaches real
// other companies' marks: "goldman" resolves to goldman.io, a different business.
// A wrong logo is worse than a monogram, so guessing has to be asked for.
const guess = argv.includes("--guess");

const ENDPOINT = "https://www.google.com/s2/favicons";
const SERVICE = "google-favicon-service";
const SOURCE = `${SERVICE} sz=128`;
const MAX_BYTES = 262144;
const CONCURRENCY = 12;
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
  ...new Set([
    `${slug}.com`,
    `${slug}.io`,
    `${slug}.co.in`,
    `${slug}.ai`,
    `${slug}.org`,
    `${slug}.co`,
  ]),
];
// Why each company was skipped, so a low hit rate can be diagnosed rather than guessed at.
const lastRejection = new Map();
// A guessed domain is only a candidate. It is believed once the site itself names
// the company, which is what separates acko.com from aurora.com (Vistance Networks).
function titleNames(title, name) {
  const parts = String(name)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!parts.length) return false;
  // Separators in the company name may be anything non-alphanumeric in the title,
  // so "AT&T" matches "AT&T" and "AT and T". Boundaries stop "aon" matching "naond".
  const pattern = `(?<![a-z0-9])${parts.join("[\\s\\W_]*")}(?![a-z0-9])`;
  return new RegExp(pattern, "i").test(title);
}
// A parked domain still answers 200, and its title usually contains the company
// name, so matching alone is not enough. ascend.com is for sale rather than the chip
// company, and amadeus.co.in is listed on DaaZ under a title that names Amadeus.
const PARKED =
  /\bfor sale\b|domain (name|names) (are |is )?for sale|parked (domain|free)|under construction|coming soon|default (web )?page|premium domain|domain name for your brand|this domain (may )?be for sale|buy (this|our|the)? ?[\w.-]* ?domain|\bdaaz\b|\bsedo\b|\bhugedomains\b|\bafternic\b|dan\.com/i;
function siteText(html) {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  const og =
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i.exec(
      html,
    )?.[1];
  const name =
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i.exec(
      html,
    )?.[1];
  return [title, og, name].filter(Boolean).join(" | ");
}
async function verifyDomain(domain, name, slug) {
  if (!verify) return { ok: true, evidence: "unverified (--no-verify)" };
  let response;
  try {
    response = await fetch(`https://${domain}/`, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    return { ok: false, reason: "unreachable" };
  }
  if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("html")) return { ok: false, reason: "not html" };
  let html;
  try {
    html = (await response.text()).slice(0, 120000);
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  const text = siteText(html);
  if (!text.trim()) return { ok: false, reason: "no title" };
  if (PARKED.test(text))
    return { ok: false, reason: "parked or listed domain" };
  if (!titleNames(text, name))
    return { ok: false, reason: "title does not name it" };
  const landed = hostOf(response.url);
  if (landed && landed !== hostOf(domain) && !brandConsistent(slug, landed))
    // The company name in the title is not enough once the page has moved: gartner.org
    // is a hotel, lowe.com is boat engines, appdynamics.com now redirects to Splunk.
    return { ok: false, reason: `redirects to ${landed}, a different brand` };
  return {
    ok: true,
    evidence:
      `site title ${JSON.stringify(text.trim().slice(0, 110))}` +
      (landed && landed !== hostOf(domain) ? ` [via ${landed}]` : ""),
  };
}
// The registrable name, skipping a subdomain prefix. in.ixl.com and intl.garena.com
// are still IXL and Garena; hotel-gartner.com and loweboats.com are not Gartner and Lowe.
const labelOf = (host) => {
  const parts = host.split(".");
  return parts.length >= 3 ? parts[1] : parts[0];
};
const squash = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
// After a redirect the landing domain still has to be the company's own brand.
// micro1.io to micro1.ai and jpmorganchase.com both satisfy this; splunk.com and
// hotel-gartner.com do not.
function brandConsistent(slug, host) {
  const label = squash(labelOf(host));
  const brand = squash(slug);
  if (!label || !brand) return true;
  return label.includes(brand) || brand.includes(label);
}
function hostOf(url) {
  // Accepts a bare hostname as well as a full URL, since candidates are bare.
  const match = String(url).match(/^(?:[a-z]+:\/\/)?(?:[^@/]*@)?([^/:?#]+)/i);
  return match ? match[1].replace(/^www\./i, "").toLowerCase() : "";
}
async function fromNetwork(slug, name) {
  if (!favicons) return null;
  const mapped = DOMAINS[slug];
  if (!mapped && !guess) return null;
  const notes = [];
  for (const domain of mapped ? [mapped] : guessed(slug)) {
    const check = await verifyDomain(domain, name, slug);
    if (!check.ok) {
      notes.push(`${domain}: ${check.reason}`);
      continue;
    }
    const url = `${ENDPOINT}?domain=${encodeURIComponent(domain)}&sz=128`;
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Mozilla/5.0", accept: "image/*,*/*" },
        signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) {
        notes.push(`${domain}: favicon HTTP ${response.status}`);
        continue;
      }
      const content_type = (response.headers.get("content-type") ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!ALLOWED.has(content_type)) {
        notes.push(`${domain}: favicon was ${content_type}`);
        continue;
      }
      const image = Buffer.from(await response.arrayBuffer());
      if (image.byteLength < 32 || image.byteLength > MAX_BYTES) {
        notes.push(`${domain}: favicon ${image.byteLength}B out of range`);
        continue;
      }
      return {
        image,
        content_type,
        source: SOURCE,
        // The evidence travels with the bytes, so a stored mark can be audited
        // without re-running this script.
        attribution:
          `Favicon fetched from ${domain} via the Google favicon service. ` +
          `Domain verified: ${check.evidence}`,
      };
    } catch {
      // One unreachable domain is not a reason to abandon the company.
    }
  }
  lastRejection.set(slug, notes);
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
async function resolve(slug, name) {
  // A supplied file always wins, so a curated mark is never overwritten by a favicon.
  return (await fromDisk(slug)) ?? (await fromNetwork(slug, name));
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
async function snapshotCompanies() {
  const file = path.join(root, "artifacts/imports/repository/snapshot.json");
  if (!existsSync(file))
    throw new Error(
      "No artifacts/imports/repository/snapshot.json. Generate it with pnpm import:repository --directory PATH.",
    );
  return JSON.parse(readFileSync(file, "utf8")).companies;
}
async function main() {
  let directory;
  if (fromSnapshot) directory = await snapshotCompanies();
  else if (only.length) {
    // Verification needs the real display name, so the import snapshot is consulted
    // for it. It holds the same names the database was populated from.
    const snapshot = path.join(
      root,
      "artifacts/imports/repository/snapshot.json",
    );
    const known = new Map(
      existsSync(snapshot)
        ? JSON.parse(readFileSync(snapshot, "utf8")).companies.map((c) => [
            c.slug,
            c.name,
          ])
        : [],
    );
    directory = only.map((slug) => ({ slug, name: known.get(slug) ?? slug }));
  } else {
    directory = (
      await (
        await db()
      ).query(
        "select slug,name from public.companies order by lower(name),slug",
      )
    ).rows;
  }
  const slugs = directory.map((c) => c.slug);
  if (fromSnapshot) slugs.sort();
  console.log(
    `${slugs.length} companies to consider${fromSnapshot ? " (from the import snapshot)" : only.length ? " (filtered from the full directory)" : ""}`,
  );
  if (fromSnapshot && !dryRun)
    throw new Error("--snapshot is for auditing. Re-run without it to write.");
  const names = new Map(directory.map((c) => [c.slug, c.name]));
  // Marks refused after review are never fetched again, so the workflow is:
  // run, read the review list, --reject the wrong ones, re-run.
  const reviewPath = path.join(root, "artifacts/logos/favicon-review.json");
  const readReview = () => {
    try {
      return JSON.parse(readFileSync(reviewPath, "utf8"));
    } catch {
      return { marks: [], rejected: [] };
    }
  };
  const review = readReview();
  const refused = new Set(review.rejected ?? []);
  for (const slug of rejecting) refused.add(slug);
  const stored = [];
  const skipped = [];
  const queue = [...slugs];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let slug = queue.shift(); slug; slug = queue.shift()) {
        // A mark refused after review is never fetched again.
        if (refused.has(slug)) {
          skipped.push(slug);
          continue;
        }
        const logo = await resolve(slug, names.get(slug) ?? slug);
        if (!logo) {
          skipped.push(slug);
          continue;
        }
        stored.push({ slug, ...logo });
      }
    }),
  );
  stored.sort((a, b) => a.slug.localeCompare(b.slug));
  const onDisk = stored.filter((l) => l.source.startsWith("local:")).length;
  for (const logo of stored)
    console.log(
      `  ${logo.slug.padEnd(24)} ${String(logo.image.byteLength).padStart(7)}B ${logo.content_type}  ${logo.attribution}`,
    );
  // Title matching proves the site belongs to something with the company's name, not
  // that it is the specific employer in the catalogue. That last judgement is a
  // human one, so every automatically accepted favicon is written out for review.
  const faviconMarks = stored.filter((l) => !l.source.startsWith("local:"));
  if (rejecting.length) {
    review.rejected = [...refused].sort();
    mkdirSync(path.dirname(reviewPath), { recursive: true });
    writeFileSync(reviewPath, JSON.stringify(review, null, 1) + "\n");
    console.log(
      `\nRefusing ${refused.size} mark(s) on future runs: ${[...refused].join(", ")}`,
    );
  }
  if (faviconMarks.length) {
    mkdirSync(path.dirname(reviewPath), { recursive: true });
    writeFileSync(
      reviewPath,
      JSON.stringify(
        {
          note: "Automatically accepted favicon marks. Read the evidence column: a title that names something other than the employer means the wrong favicon was accepted, and no string rule can catch that. Reject those with --reject <slug>, then re-run.",
          generated_by: "scripts/logos/fetch.mjs",
          marks: faviconMarks.map((l) => ({
            slug: l.slug,
            evidence: l.attribution.replace(/^Favicon fetched from /, ""),
          })),
          rejected: review.rejected ?? [],
        },
        null,
        1,
      ) + "\n",
    );
    console.log(`\nReview list written to ${path.relative(root, reviewPath)}.`);
  }
  console.log(
    `\n${stored.length} marks resolved (${onDisk} vendored artwork, ${stored.length - onDisk} favicons), ${skipped.length} companies keep their monogram.`,
  );
  if (verify && skipped.length) {
    // A rejected domain is usually right and blocked, or wrong and correctly
    // refused. Grouping by reason tells those apart at a glance.
    const reasons = new Map();
    for (const slug of skipped) {
      for (const note of lastRejection.get(slug) ?? []) {
        const reason = note.split(": ").slice(1).join(": ");
        reasons.set(reason, (reasons.get(reason) || 0) + 1);
      }
    }
    if (reasons.size) {
      console.log("Why candidates were refused:");
      for (const [reason, count] of [...reasons].sort((a, b) => b[1] - a[1]))
        console.log(`  ${String(count).padStart(4)}  ${reason}`);
    }
  }
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
      image: logo.image.toString("hex"),
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
