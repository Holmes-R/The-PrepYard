// Run after build against the migrated disposable cluster, never the app database.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { hashPassword, newEmailToken } from "../../src/lib/auth/password.mjs";
const databaseUrl = process.env.PREPYARD_AUTH_TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error(
    "Set PREPYARD_AUTH_TEST_DATABASE_URL to the migrated disposable database.",
  );
const database = new URL(databaseUrl);
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname) ||
  !database.pathname.endsWith("_test")
)
  throw new Error("Only a disposable loopback _test database is allowed.");
const admin = new pg.Client({ connectionString: databaseUrl });
await admin.connect();
const id = randomUUID();
const email = `flow-${id}@example.test`;
const password = "test-only separate PrepYard password";
const base = "http://127.0.0.1:3114";
let server;
let student;
try {
  await admin.query("alter role prepyard_web login");
  const loginUrl = new URL(database);
  loginUrl.username = "prepyard_web";
  const pending = newEmailToken();
  await admin.query(
    "select private.issue_email_token($1,'verify',$2,'Flow Test',$3)",
    [email, await hashPassword(password), pending.digest],
  );
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3114",
    ],
    {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      env: {
        ...process.env,
        DATABASE_URL: loginUrl.href,
        AUTH_URL: base,
        AUTH_SECRET: randomBytes(32).toString("hex"),
        AUTH_GOOGLE_ID: "",
        AUTH_GOOGLE_SECRET: "",
        RESEND_API_KEY: "",
        AUTH_EMAIL_FROM: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  server.stdout.on("data", (d) => {
    output += d;
  });
  server.stderr.on("data", (d) => {
    output += d;
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(output);
    try {
      await fetch(base + "/login");
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  assert.ok(ready, "Test server starts");
  assert.deepEqual(
    Object.keys(await (await fetch(base + "/api/auth/providers")).json()),
    ["credentials"],
    "Password login works independently of Google configuration",
  );
  const cookies = (response) =>
    response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
  async function login(value, csrf = true) {
    const res = await fetch(base + "/api/auth/csrf");
    const token = (await res.json()).csrfToken;
    return fetch(base + "/api/auth/callback/credentials", {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies(res),
      },
      body: new URLSearchParams({
        email,
        password: value,
        csrfToken: csrf ? token : "invalid",
        callbackUrl: base + "/dashboard",
      }),
    });
  }
  const unverified = await login(password);
  assert.ok(
    !cookies(unverified).includes("authjs.session-token="),
    "Unverified login denied",
  );
  assert.equal(
    (
      await admin.query(
        "select private.consume_email_token($1,'verify',null) as ok",
        [pending.digest],
      )
    ).rows[0].ok,
    true,
  );
  student = (
    await admin.query("select id from private.password_identity($1)", [email])
  ).rows[0].id;
  assert.ok(
    !cookies(await login("an incorrect password value")).includes(
      "authjs.session-token=",
    ),
    "Wrong password denied",
  );
  assert.ok(
    !cookies(await login(password, false)).includes("authjs.session-token="),
    "Invalid CSRF denied",
  );
  const accepted = await login(password);
  const sessionCookie = cookies(accepted);
  assert.match(
    sessionCookie,
    /authjs.session-token=/,
    "Verified login creates session",
  );
  const authenticated = {
    redirect: "manual",
    headers: { Cookie: sessionCookie },
  };
  assert.equal((await fetch(base + "/dashboard", authenticated)).status, 200);
  assert.equal((await fetch(base + "/api/health", authenticated)).status, 200);
  const session = await (
    await fetch(base + "/api/auth/session", authenticated)
  ).json();
  assert.equal(session.user.id, student);
  assert.equal(session.user.email, email);
  assert.equal(session.user.password_hash, undefined);
  const reset = newEmailToken();
  await admin.query("select private.issue_email_token($1,'reset',null,'',$2)", [
    email,
    reset.digest,
  ]);
  const replacement = "a brand new PrepYard password";
  await admin.query("select private.consume_email_token($1,'reset',$2)", [
    reset.digest,
    await hashPassword(replacement),
  ]);
  assert.equal(
    (await fetch(base + "/api/health", authenticated)).status,
    401,
    "Reset revokes active password session",
  );
  assert.equal((await fetch(base + "/dashboard", authenticated)).status, 307);
  assert.ok(
    !cookies(await login(password)).includes("authjs.session-token="),
    "Old password no longer works",
  );
  assert.match(
    cookies(await login(replacement)),
    /authjs.session-token=/,
    "New password works",
  );
  for (let attempt = 0; attempt < 11; attempt++)
    await login("wrong password attempt");
  assert.ok(
    !cookies(await login(replacement)).includes("authjs.session-token="),
    "Attempt limit blocks further logins",
  );
  console.log(
    "Password flow passed: unverified/wrong-password/CSRF denial, verified login, Google-independent access, private session payload, reset revocation, new password and rate limits.",
  );
} finally {
  if (server) {
    server.kill();
    if (server.exitCode === null)
      await new Promise((resolve) => server.once("exit", resolve));
  }
  await admin.query("delete from private.email_tokens where email=$1", [email]);
  if (student)
    await admin.query("delete from private.students where id=$1", [student]);
  await admin.end();
}
