import { readFile, writeFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadRepository } from "../import/adapters/repository.mjs";

const root = new URL("../../", import.meta.url);
const args = process.argv.slice(2);
const refresh = args.includes("--refresh");
const directoryIndex = args.indexOf("--directory");
const directory = directoryIndex >= 0 ? args[directoryIndex + 1] : null;
if (directoryIndex >= 0 && (!directory || directory.startsWith("--")))
  throw new Error("--directory needs the extracted pinned company snapshot");
if (
  args.some(
    (a, i) =>
      !["--refresh", "--directory"].includes(a) &&
      !(directoryIndex >= 0 && i === directoryIndex + 1),
  )
)
  throw new Error("Use practice:audit [--refresh] [--directory PATH]");
const accessFile = new URL("src/features/questions/leetcode-access.json", root);
const access = JSON.parse(await readFile(accessFile, "utf8"));
if (refresh) {
  const response = await fetch("https://leetcode.com/api/problems/all/", {
    headers: { "user-agent": "PrepYard catalogue access audit" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(
      `Access audit returned ${response.status}; previous snapshot preserved`,
    );
  const body = await response.text();
  const payload = JSON.parse(body);
  if (
    !Array.isArray(payload.stat_status_pairs) ||
    payload.stat_status_pairs.length < 3000
  )
    throw new Error("Incomplete access response; previous snapshot preserved");
  const questions = payload.stat_status_pairs
    .map((q) => {
      if (
        !Number.isInteger(q.stat?.frontend_question_id) ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(q.stat.question__title_slug ?? "") ||
        typeof q.paid_only !== "boolean" ||
        !q.stat.question__title
      )
        throw new Error(
          "Malformed access metadata; previous snapshot preserved",
        );
      return {
        id: q.stat.frontend_question_id,
        slug: q.stat.question__title_slug,
        title: q.stat.question__title,
        paid_only: q.paid_only,
      };
    })
    .sort((a, b) => a.id - b.id);
  if (new Set(questions.map((q) => q.slug)).size !== questions.length)
    throw new Error("Duplicate slugs; previous snapshot preserved");
  Object.assign(access, {
    checked_at: new Date().toISOString(),
    sha256: createHash("sha256").update(body).digest("hex"),
    questions,
  });
  const temporary = new URL(accessFile.href + ".tmp");
  await writeFile(temporary, JSON.stringify(access, null, 2) + "\n");
  await rename(temporary, accessFile);
}
const manifest = JSON.parse(
  await readFile(
    new URL("src/features/questions/reviewed-alternatives.json", root),
    "utf8",
  ),
);
const reviewed = new Map(manifest.alternatives.map((q) => [q.source_slug, q]));
let catalogue = directory ? (await loadRepository(directory)).questions : [];
const roadmap = JSON.parse(
  await readFile(new URL("src/features/patterns/roadmap.json", root), "utf8"),
);
catalogue.push(
  ...roadmap.patterns.flatMap((p) =>
    p.questions.map((q) => ({ canonical_url: q.url })),
  ),
);
const collections = JSON.parse(
  await readFile(new URL("scripts/patterns/collections.json", root), "utf8"),
);
// Collection manifests may add questions not present in the company snapshot.
for (const c of collections.collections ?? [])
  for (const q of c.questions ?? [])
    if (q.url) catalogue.push({ canonical_url: q.url });
const inCatalogue = new Set(
  catalogue
    .filter((q) =>
      q.canonical_url?.startsWith("https://leetcode.com/problems/"),
    )
    .map((q) => new URL(q.canonical_url).pathname.split("/")[2]),
);
const paid = access.questions.filter(
  (q) => q.paid_only && inCatalogue.has(q.slug),
);
const report = {
  access_checked_at: access.checked_at,
  scope: directory
    ? "pinned repository, roadmap and practice collections"
    : "roadmap and practice collections (pass --directory for company coverage)",
  catalogue_questions: inCatalogue.size,
  paid_questions: paid.length,
  replaced: paid
    .filter((q) => reviewed.has(q.slug))
    .map((q) => ({ ...q, alternative: reviewed.get(q.slug).url })),
  pending: paid.filter((q) => !reviewed.has(q.slug)),
};
const reportFile = new URL("scripts/practice/audit-report.json", root);
await writeFile(reportFile, JSON.stringify(report, null, 2) + "\n");
console.log(
  `${report.catalogue_questions} unique questions audited; ${report.replaced.length} replacements; ${report.pending.length} pending.`,
);
console.log(`Internal report: ${fileURLToPath(reportFile)}`);
console.log(
  "No database records changed. Review and commit artifacts before deploying.",
);
