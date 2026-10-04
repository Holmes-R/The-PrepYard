// Downloads original brand marks from Simple Icons and vendors them per company.
//
// Simple Icons is the right source for this: the marks are the real brand artwork,
// the set is CC0-1.0 so there is no permission to track, and every entry carries a
// brand hex. The favicon service used before cannot supply either.
//
//   node scripts/logos/vendor.mjs                     # download and vendor
//   node scripts/logos/vendor.mjs --package DIR       # reuse an extracted npm package
//   node scripts/logos/vendor.mjs --report            # coverage only, write nothing
//
// Output is assets/company-logos/<company-slug>.svg plus a manifest recording which
// brand each file came from, so a mark can be audited or replaced later. Publishing
// to the database is a separate step: pnpm logos:fetch -- --from assets/company-logos.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => {
  const at = argv.indexOf(name);
  return at === -1 ? "" : (argv[at + 1] ?? "");
};
const packageDir = option("--package");
const reportOnly = flag("--report");
const outDir = path.join(root, option("--out") || "assets/company-logos");
const registry = "https://registry.npmjs.org/simple-icons/latest";
// Staged outside the repository. An extracted package under artifacts/ would be
// gitignored but still linted and typechecked, and it is a few thousand files.
const staging = path.join(tmpdir(), "prepyard-simple-icons");

async function download() {
  const meta = await (
    await fetch(registry, { signal: AbortSignal.timeout(30000) })
  ).json();
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  const archive = path.join(staging, "package.tgz");
  const response = await fetch(meta.dist.tarball, {
    signal: AbortSignal.timeout(180000),
  });
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  // No tar implementation ships with Node, and every supported platform has one.
  const untar = spawnSync("tar", ["-xzf", archive, "-C", staging], {
    stdio: "inherit",
  });
  if (untar.error || untar.status !== 0)
    throw new Error(
      "Could not extract the archive. Install tar, or pass --package DIR with an already extracted simple-icons package.",
    );
  return { dir: path.join(staging, "package"), version: meta.version };
}
// Simple Icons filenames are the title lowercased with every non-alphanumeric
// removed: "Adobe Photoshop" ships as adobephotoshop.svg. v14+ also carries an
// explicit slug, which is used when present.
function deriveSlug(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
function loadBrands(dir) {
  // v16 moved _data/ to data/ and flattened the array; older releases nest it.
  const metadata = ["data/simple-icons.json", "_data/simple-icons.json"]
    .map((rel) => path.join(dir, rel))
    .find((file) => existsSync(file));
  if (!metadata) throw new Error(`No simple-icons.json under ${dir}`);
  const parsed = JSON.parse(readFileSync(metadata, "utf8"));
  const brands = Array.isArray(parsed) ? parsed : parsed.icons;
  if (!Array.isArray(brands))
    throw new Error(`Unrecognised simple-icons.json shape under ${dir}`);
  const unresolved = [];
  const usable = brands
    .map((brand) => {
      const slug = brand.slug ?? deriveSlug(brand.title);
      const file = path.join(dir, "icons", slug + ".svg");
      if (!existsSync(file)) {
        unresolved.push(brand.title);
        return null;
      }
      return {
        ...brand,
        slug,
        file,
        aliases: [
          ...(brand.aliases?.aka ?? []),
          ...Object.values(brand.aliases?.loc ?? {}).flat(),
        ].map(normalise),
      };
    })
    .filter(Boolean);
  if (unresolved.length)
    console.log(
      `  ${unresolved.length} brand(s) had no icon file and were skipped.`,
    );
  return usable;
}
// "J.P. Morgan" and "jp-morgan" must both reach the same key, so punctuation, spaces
// and "&" all disappear. "AT&T" additionally tries the "and" reading.
function normalise(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");
}
const SUFFIXES = [
  "technologies",
  "technology",
  "solutions",
  "software",
  "services",
  "consulting",
  "international",
  "global",
  "corporation",
  "corporate",
  "holdings",
  "laboratory",
  "company",
  "limited",
  "private",
  "group",
  "labs",
  "tech",
  "inc",
  "llc",
  "ltd",
  "corp",
  "gmbh",
  "plc",
  "pvt",
  "sa",
  "ag",
  "nv",
  "bv",
  "co",
];
function stems(name) {
  const base = normalise(name);
  const words = String(name)
    .toLowerCase()
    .replace(/&/g, " and ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const found = new Set([base, base.replace(/and/g, "")]);
  for (let i = 0; i < words.length; i++) {
    if (!SUFFIXES.includes(words[i])) continue;
    const trimmed = normalise(words.slice(0, i).join(""));
    // A one or two letter remainder matches far too much to be trusted.
    if (trimmed.length >= 4) found.add(trimmed);
  }
  return [...found].filter(Boolean);
}
function buildIndex(brands) {
  const index = new Map();
  const add = (key, brand) => {
    if (!key) return;
    const existing = index.get(key);
    // Two brands answering to one name is a coin flip, not a match. Once a key is
    // ambiguous it stays that way, whatever else claims it later.
    if (existing?.ambiguous) return;
    if (existing && existing.brand.slug !== brand.slug)
      index.set(key, { ambiguous: true });
    else if (!existing) index.set(key, { brand });
  };
  for (const brand of brands) {
    add(normalise(brand.slug), brand);
    add(normalise(brand.title), brand);
    add(normalise(brand.title.replace(/&/g, "")), brand);
    for (const alias of brand.aliases) add(alias, brand);
  }
  return index;
}
function resolve(company, index) {
  const attempts = [
    normalise(company.slug),
    ...stems(company.name),
    ...stems(company.slug),
  ];
  for (const key of attempts) {
    const hit = index.get(key);
    if (hit?.brand) return { brand: hit.brand, via: key };
    if (hit?.ambiguous) return { ambiguous: key };
  }
  return null;
}
// Newer metadata carries licence as {type,url}; older as a bare string or absent.
function licenceOf(brand) {
  const value = brand.license;
  if (!value) return "CC0-1.0";
  if (typeof value === "string") return value;
  return value.type ?? "CC0-1.0";
}
// Simple Icons ships one-colour paths, so the mark is the brand hex on a white tile.
function coloured(svg, hex) {
  if (!/^#?[0-9A-F]{6}$/i.test(hex)) return svg;
  return svg.replace("<svg ", `<svg fill="#${hex.replace(/^#/, "")}" `);
}
function readCompanies() {
  const snapshot = path.join(
    root,
    "artifacts/imports/repository/snapshot.json",
  );
  if (!existsSync(snapshot))
    throw new Error(
      "No artifacts/imports/repository/snapshot.json. Generate it with pnpm import:repository --directory PATH, or pass --package DIR to vendor the marks on their own.",
    );
  return JSON.parse(readFileSync(snapshot, "utf8")).companies;
}
const { dir, version } = packageDir
  ? { dir: packageDir, version: "supplied" }
  : await download();
const brands = loadBrands(dir);
const index = buildIndex(brands);
const companies = readCompanies();
console.log(
  `Simple Icons ${version}: ${brands.length} brands. Matching ${companies.length} companies.`,
);
if (!reportOnly) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
}
const manifest = [];
const missing = [];
const ambiguous = [];
for (const company of companies) {
  const hit = resolve(company, index);
  if (!hit) {
    missing.push(company.slug);
    continue;
  }
  if (hit.ambiguous) {
    ambiguous.push(`${company.slug} (${hit.ambiguous})`);
    continue;
  }
  const raw = readFileSync(hit.brand.file, "utf8");
  // The mark is going into a web page, so anything but a plain path is refused
  // rather than trusted.
  if (
    !/^<svg[\s\S]*<\/svg>\s*$/.test(raw.trim()) ||
    /<script|<foreignObject/i.test(raw)
  )
    throw new Error(`Refusing unexpected SVG for ${company.slug}`);
  const svg = coloured(raw.trim(), hit.brand.hex);
  if (!reportOnly)
    writeFileSync(path.join(outDir, company.slug + ".svg"), svg + "\n");
  manifest.push({
    slug: company.slug,
    name: company.name,
    brand: hit.brand.title,
    brand_slug: hit.brand.slug,
    hex: hit.brand.hex,
    source: hit.brand.source,
    license: licenceOf(hit.brand),
    matched_on: hit.via,
    sha256: createHash("sha256").update(svg).digest("hex"),
  });
}
const licenses = [...new Set(manifest.map((m) => m.license))];
if (!reportOnly) {
  writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(
      {
        generator: "scripts/logos/vendor.mjs",
        source: `simple-icons@${version}`,
        license: "CC0-1.0 unless a per-brand license says otherwise",
        count: manifest.length,
        brands: manifest,
      },
      null,
      1,
    ) + "\n",
  );
  const exceptions = manifest.filter((m) => m.license !== "CC0-1.0");
  writeFileSync(
    path.join(outDir, "ATTRIBUTION.md"),
    `# Company logos\n\n` +
      `Original brand marks from [Simple Icons](https://simpleicons.org) \`${version}\`. ` +
      `Each file is the Simple Icons path recoloured with that brand's own hex, so it ` +
      `is not a byte-for-byte copy of the upstream file. Generated by ` +
      `\`scripts/logos/vendor.mjs\`; do not edit by hand.\n\n` +
      `Every brand, its hex, its upstream source URL and its licence are recorded in ` +
      `\`manifest.json\`.\n\n` +
      (exceptions.length
        ? `## Not CC0\n\n` +
          exceptions
            .map(
              (m) =>
                `- **${m.brand}** (\`${m.slug}\`) — ${m.license}. Source: ${m.source}`,
            )
            .join("\n") +
          "\n\n"
        : `All ${manifest.length} marks are CC0-1.0.\n\n`) +
      `## Coverage\n\n` +
      `${manifest.length} of the companies in the catalogue have a mark here. The rest ` +
      `keep a generated monogram: Simple Icons has no entry for them, and no free bulk ` +
      `source carries original artwork for the long tail. See \`scripts/logos/README.md\`.\n`,
  );
}
console.log(
  `\n${manifest.length}/${companies.length} companies matched (${Math.round((manifest.length / companies.length) * 100)}%).`,
);
console.log(`Licenses present: ${licenses.join(", ")}`);
if (ambiguous.length)
  console.log(
    `Ambiguous, left unmatched: ${ambiguous.slice(0, 15).join(", ")}${ambiguous.length > 15 ? `, +${ambiguous.length - 15} more` : ""}`,
  );
console.log(
  `No mark available: ${missing.length}${missing.length ? ` (${missing.slice(0, 25).join(", ")}${missing.length > 25 ? ", ..." : ""})` : ""}`,
);
if (!reportOnly)
  console.log(
    `\nWrote ${manifest.length} marks to ${path.relative(root, outDir)}.`,
  );
