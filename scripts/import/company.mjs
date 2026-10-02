import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCompanySnapshot } from "./adapters/company-csv.mjs";
import { toStagingSql } from "./publish/stage-sql.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
if (
  args.length !== 0 &&
  !(args.length === 2 && args[0] === "--out" && args[1].trim())
) {
  throw new Error(
    "Usage: node scripts/import/company.mjs [--out output-directory]",
  );
}
const snapshot = await loadCompanySnapshot(
  path.join(root, "tests/fixtures/cs-satyam/1kosmos/manifest.json"),
);
const output = path.resolve(root, args[1] || "artifacts/imports/1kosmos");
await mkdir(output, { recursive: true });
// Validate the entire snapshot before creating any output.
await writeFile(
  path.join(output, "snapshot.json"),
  JSON.stringify(snapshot, null, 2) + "\n",
);
await writeFile(path.join(output, "stage.sql"), toStagingSql(snapshot));
console.log(
  JSON.stringify(
    {
      company: snapshot.source.company.name,
      revision: snapshot.source.revision,
      questions: snapshot.questions.length,
      observations: snapshot.observations.length,
      output,
      status: "staging-artifacts-written",
      database_modified: false,
    },
    null,
    2,
  ),
);
