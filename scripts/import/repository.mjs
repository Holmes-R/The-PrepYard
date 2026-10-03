import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { loadRepository } from "./adapters/repository.mjs";
import { publishRepository } from "./publish/repository.mjs";
const args = process.argv.slice(2);
if (
  args[0] !== "--directory" ||
  !args[1] ||
  !(args.length === 2 || (args.length === 3 && args[2] === "--approve-source"))
)
  throw new Error(
    "Usage: pnpm import:repository --directory PATH [--approve-source]",
  );
const data = await loadRepository(path.resolve(args[1]));
await mkdir("artifacts/imports/repository", { recursive: true });
await writeFile(
  "artifacts/imports/repository/snapshot.json",
  JSON.stringify(data),
);
if (args[2]) {
  if (!process.env.IMPORT_DATABASE_URL)
    throw new Error("IMPORT_DATABASE_URL is required");
  const client = new pg.Client({
    connectionString: process.env.IMPORT_DATABASE_URL,
  });
  try {
    await client.connect();
    console.log(JSON.stringify(await publishRepository(client, data)));
  } finally {
    await client.end();
  }
} else
  console.log(
    JSON.stringify({
      companies: data.companies.length,
      questions: data.questions.length,
      observations: data.observations.length,
      database_modified: false,
    }),
  );
