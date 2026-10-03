import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadCompanySnapshot } from "./adapters/company-csv.mjs";
import { publishFixture } from "./publish/publish-fixture.mjs";
if (process.argv.slice(2).join(" ") !== "--approve-source")
  throw new Error(
    "Usage: pnpm import:publish --approve-source. Explicitly approves this fixed metadata source for student access.",
  );
if (!process.env.IMPORT_DATABASE_URL)
  throw new Error(
    "Set IMPORT_DATABASE_URL to a trusted administrator connection, never the browser or runtime login.",
  );
const fixture = fileURLToPath(
  new URL("../../tests/fixtures/cs-satyam/1kosmos/", import.meta.url),
);
const snapshot = await loadCompanySnapshot(fixture + "manifest.json");
const expected = JSON.parse(await readFile(fixture + "expected.json", "utf8"));
const client = new pg.Client({
  connectionString: process.env.IMPORT_DATABASE_URL,
});
try {
  await client.connect();
  console.log(
    JSON.stringify(await publishFixture(client, snapshot, expected), null, 2),
  );
} finally {
  await client.end();
}
