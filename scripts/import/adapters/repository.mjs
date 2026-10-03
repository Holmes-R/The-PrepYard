import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { parseCompanyCsv, PINNED_REVISION } from "./company-csv.mjs";
const names = {
  "1kosmos": "1Kosmos",
  "6sense": "6sense",
  ibm: "IBM",
  amd: "AMD",
  adp: "ADP",
  att: "AT&T",
  hpe: "HPE",
  hp: "HP",
  "jp-morgan": "J.P. Morgan",
  jpmorgan: "JPMorgan",
  linkedin: "LinkedIn",
  bytedance: "ByteDance",
  openai: "OpenAI",
  paypal: "PayPal",
  tiktok: "TikTok",
  tcs: "TCS",
  pwc: "PwC",
  "bny-mellon": "BNY Mellon",
  "d-e-shaw": "D. E. Shaw",
};
export async function loadRepository(directory) {
  const manifest = JSON.parse(
    await readFile(
      new URL("../repository-manifest.json", import.meta.url),
      "utf8",
    ),
  );
  if (manifest.revision !== PINNED_REVISION)
    throw new Error("Unreviewed repository revision");
  const questions = new Map(),
    companies = new Map(),
    urls = new Map(),
    observations = [];
  for (const file of manifest.files) {
    const parts = file.path.split("/");
    if (parts.length !== 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parts[0]))
      throw new Error("Invalid company path");
    const [slug, filename] = parts;
    const bytes = await readFile(path.join(directory, slug, filename));
    const hash = createHash("sha1")
      .update("blob " + bytes.length + "\0")
      .update(bytes)
      .digest("hex");
    if (bytes.length !== file.size || hash !== file.git_blob)
      throw new Error("Repository file mismatch: " + file.path);
    companies.set(slug, {
      slug,
      name:
        names[slug] ||
        slug
          .split("-")
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(" "),
    });
    for (const { question, observation } of parseCompanyCsv(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      filename,
    )) {
      const previous = questions.get(question.external_id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(question))
        throw new Error(
          "Conflicting question identity: " + question.external_id,
        );
      if (
        urls.has(question.canonical_url) &&
        urls.get(question.canonical_url) !== question.external_id
      )
        throw new Error("Conflicting URL identity");
      questions.set(question.external_id, question);
      urls.set(question.canonical_url, question.external_id);
      observations.push({ company_slug: slug, ...observation });
    }
  }
  if (companies.size !== manifest.company_count)
    throw new Error("Incomplete company directory");
  return {
    revision: manifest.revision,
    companies: [...companies.values()],
    questions: [...questions.values()].sort(
      (a, b) => Number(a.external_id) - Number(b.external_id),
    ),
    observations,
  };
}
