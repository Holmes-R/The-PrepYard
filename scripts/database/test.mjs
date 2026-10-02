// Applies real migrations to an EMPTY, disposable loopback PostgreSQL database.
// Never loads .env.local and never accepts a hosted database URL.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const host = process.env.PGHOST;
const database = process.env.PGDATABASE;
if (
  !["localhost", "127.0.0.1", "::1"].includes(host) ||
  !database?.endsWith("_test")
) {
  throw new Error(
    "Set PGHOST to loopback and PGDATABASE to a disposable name ending in _test.",
  );
}
const executable = process.env.PSQL_BIN || "psql";
function psql(args, capture = false) {
  const result = spawnSync(
    executable,
    ["-X", "-v", "ON_ERROR_STOP=1", ...args],
    {
      cwd: root,
      encoding: "utf8",
      env: process.env,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (capture) process.stderr.write(result.stderr || "");
    throw new Error("Database check failed; inspect psql output above.");
  }
  return result.stdout?.trim();
}
const empty = psql(
  [
    "-At",
    "-c",
    "select not exists(select 1 from pg_namespace where nspname='auth') and not exists(select 1 from pg_tables where schemaname='public') and not exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role'))",
  ],
  true,
);
if (empty !== "t")
  throw new Error(
    "Refusing to modify a nonempty or Supabase-like database/cluster. Use a fresh isolated PostgreSQL instance.",
  );

psql(["-f", "tests/database/bootstrap.sql"]);
for (const file of readdirSync(path.join(root, "supabase/migrations"))
  .filter((name) => name.endsWith(".sql"))
  .sort()) {
  if (file === "20261002000500_google_identity.sql")
    psql(["-f", "tests/database/google-preflight.sql"]);
  console.log("Applying", file);
  psql(["-f", path.join("supabase/migrations", file)]);
  if (file === "20261002000400_members_only.sql")
    psql(["-f", "tests/database/members-only.sql"]);
  if (file === "20261002000300_access_and_publication.sql") {
    psql(["-f", "tests/database/policies.sql"]);
    const historicalImporter = spawnSync(
      process.execPath,
      ["tests/import/database.mjs"],
      {
        cwd: root,
        env: { ...process.env, PREPYARD_DATABASE_TESTS: "1" },
        stdio: "inherit",
      },
    );
    if (historicalImporter.error || historicalImporter.status !== 0)
      throw new Error("Historical importer checks failed");
  }
}
psql(["-f", "tests/database/google-identity.sql"]);
console.log(
  "Database checks passed. Disposable database retained; this runner never drops databases.",
);
