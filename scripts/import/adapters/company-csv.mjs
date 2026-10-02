import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const header = [
  "ID",
  "URL",
  "Title",
  "Difficulty",
  "Acceptance %",
  "Frequency %",
];
export const windows = Object.freeze({
  "thirty-days.csv": "30d",
  "two-months.csv": "60d",
  "three-months.csv": "90d",
  "six-months.csv": "180d",
  "one-year.csv": "1y",
  "more-than-six-months.csv": "older-than-180d",
  "all.csv": "all",
});
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
// Strict RFC-4180-style parser: quotes, escaped quotes, embedded commas/newlines,
// BOM, LF/CRLF. Reject malformed quoting rather than silently shifting columns.
export function parseCsv(input) {
  const text = input.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [],
    field = "",
    state = "plain",
    started = false;
  const finishField = () => {
    row.push(field);
    field = "";
    state = "plain";
  };
  const finishRow = () => {
    finishField();
    if (started || row.some((cell) => cell !== "")) rows.push(row);
    row = [];
    started = false;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (state === "quoted") {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else state = "closed";
      } else field += ch;
      continue;
    }
    if (ch === ",") {
      finishField();
      started = true;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      finishRow();
      continue;
    }
    if (state === "closed")
      throw new Error("Unexpected character after closing CSV quote");
    if (ch === '"') {
      requireValue(field === "", "Quote inside an unquoted CSV field");
      state = "quoted";
      started = true;
    } else {
      field += ch;
      started = true;
    }
  }
  requireValue(state !== "quoted", "Unclosed CSV quote");
  if (started || field !== "" || row.length) finishRow();
  return rows;
}
function percentage(value, label) {
  if (value.trim() === "") return null;
  requireValue(/^\d+(?:\.\d+)?%$/.test(value), label + " must be a percentage");
  const parsed = Number(value.slice(0, -1));
  requireValue(
    Number.isFinite(parsed) && parsed >= 0 && parsed <= 100,
    label + " is outside 0–100",
  );
  return parsed;
}
export function parseCompanyCsv(text, filename) {
  requireValue(
    Object.hasOwn(windows, filename),
    "Unsupported source filename: " + filename,
  );
  const [actualHeader, ...rows] = parseCsv(text);
  requireValue(
    JSON.stringify(actualHeader) === JSON.stringify(header),
    "Unexpected CSV header",
  );
  requireValue(rows.length > 0, "Empty company file");
  const seenIds = new Set(),
    seenUrls = new Set();
  return rows.map((cells, index) => {
    const label = filename + " row " + (index + 2);
    requireValue(
      cells.length === header.length,
      label + ": wrong column count",
    );
    const [id, url, title, difficulty, acceptance, frequency] = cells;
    requireValue(
      /^[1-9]\d*$/.test(id) && id.length <= 200,
      label + ": invalid problem ID",
    );
    requireValue(
      /^https:\/\/leetcode\.com\/problems\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(
        url,
      ),
      label + ": invalid LeetCode URL",
    );
    requireValue(
      title === title.trim() && title.length > 0 && title.length <= 500,
      label + ": invalid title",
    );
    requireValue(
      ["Easy", "Medium", "Hard"].includes(difficulty),
      label + ": invalid difficulty",
    );
    const canonicalUrl = url.replace(/\/$/, "");
    requireValue(
      !seenIds.has(id) && !seenUrls.has(canonicalUrl),
      label + ": duplicate question in window",
    );
    seenIds.add(id);
    seenUrls.add(canonicalUrl);
    return {
      question: {
        external_id: id,
        canonical_url: canonicalUrl,
        title,
        difficulty: difficulty.toLowerCase(),
        original_difficulty: difficulty,
      },
      observation: {
        external_id: id,
        time_window: windows[filename],
        frequency: percentage(frequency, label + " frequency"),
        frequency_kind: frequency.trim() === "" ? "unknown" : "percent",
        source_rank: null,
        acceptance_percent: percentage(acceptance, label + " acceptance"),
      },
    };
  });
}
export async function loadCompanySnapshot(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  requireValue(manifest.schema_version === 1, "Unsupported manifest version");
  requireValue(
    manifest.repository ===
      "https://github.com/cs-satyam/leetcode-companywise-questions",
    "Unexpected repository",
  );
  requireValue(
    /^[a-f0-9]{40}$/.test(manifest.revision),
    "Source must be pinned to a full commit SHA",
  );
  requireValue(
    manifest.company?.slug === "1kosmos" &&
      manifest.company?.name === "1Kosmos",
    "This adapter currently imports 1Kosmos",
  );
  requireValue(
    manifest.source_slug === "cs-satyam-1kosmos",
    "Unexpected source slug",
  );
  requireValue(
    typeof manifest.attribution === "string" &&
      manifest.attribution.trim().length > 0 &&
      manifest.attribution.length <= 2000,
    "Missing attribution",
  );
  requireValue(
    manifest.dataset_date === null ||
      (/^\d{4}-\d{2}-\d{2}$/.test(manifest.dataset_date) &&
        new Date(manifest.dataset_date).toISOString().slice(0, 10) ===
          manifest.dataset_date),
    "Invalid dataset date",
  );
  requireValue(
    Array.isArray(manifest.files) && manifest.files.length === 2,
    "Expected the complete two-file 1Kosmos snapshot",
  );
  requireValue(
    JSON.stringify(manifest.files.map((f) => f.path).sort()) ===
      JSON.stringify(["all.csv", "more-than-six-months.csv"]),
    "Missing or unexpected source files",
  );
  const questions = new Map(),
    observations = [],
    urls = new Map();
  for (const file of manifest.files) {
    requireValue(
      file.repository_path === "1kosmos/" + file.path &&
        file.window === windows[file.path],
      "Filename/window mismatch",
    );
    requireValue(/^[a-f0-9]{64}$/.test(file.sha256), "Missing SHA-256");
    requireValue(
      Number.isSafeInteger(file.rows) && file.rows > 0,
      "Invalid expected row count",
    );
    const bytes = await readFile(
      path.join(path.dirname(manifestPath), file.path),
    );
    requireValue(
      createHash("sha256").update(bytes).digest("hex") === file.sha256,
      "Checksum mismatch: " + file.path,
    );
    const records = parseCompanyCsv(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      file.path,
    );
    requireValue(
      records.length === file.rows,
      "Row count mismatch: " + file.path,
    );
    for (const { question, observation } of records) {
      const previous = questions.get(question.external_id);
      requireValue(
        !previous || JSON.stringify(previous) === JSON.stringify(question),
        "Conflicting question metadata across windows",
      );
      const urlOwner = urls.get(question.canonical_url);
      requireValue(
        !urlOwner || urlOwner === question.external_id,
        "Conflicting problem IDs for one URL",
      );
      questions.set(question.external_id, question);
      urls.set(question.canonical_url, question.external_id);
      observations.push(observation);
    }
  }
  return {
    schema_version: 1,
    source: {
      slug: manifest.source_slug,
      repository: manifest.repository,
      revision: manifest.revision,
      dataset_date: manifest.dataset_date,
      attribution: manifest.attribution,
      company: manifest.company,
      files: manifest.files,
    },
    platform: {
      slug: "leetcode",
      name: "LeetCode",
      base_url: "https://leetcode.com",
    },
    questions: [...questions.values()].sort((a, b) =>
      a.external_id.localeCompare(b.external_id, "en", { numeric: true }),
    ),
    observations: observations.sort((a, b) =>
      (a.time_window + ":" + a.external_id).localeCompare(
        b.time_window + ":" + b.external_id,
        "en",
      ),
    ),
  };
}
