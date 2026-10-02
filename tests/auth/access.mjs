import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const port = 3112;
// Explicitly exercise missing configuration: the application must fail closed.
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      AUTH_SECRET: "",
      AUTH_GOOGLE_ID: "",
      AUTH_GOOGLE_SECRET: "",
      DATABASE_URL: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
server.stdout.on("data", (value) => {
  output += value;
});
server.stderr.on("data", (value) => {
  output += value;
});
const base = `http://127.0.0.1:${port}`;
try {
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
  assert.ok(ready, output);
  for (const route of [
    "/",
    "/explore",
    "/companies",
    "/patterns",
    "/about",
    "/dashboard",
    "/notes",
    "/sources",
    "/unknown-route",
  ]) {
    const response = await fetch(base + route, {
      redirect: "manual",
      headers: { Cookie: "authjs.session-token=forged-session" },
    });
    assert.equal(response.status, 307, route);
    assert.equal(
      new URL(response.headers.get("location"), base).pathname,
      "/login",
      route,
    );
    assert.match(response.headers.get("cache-control"), /no-store/);
  }
  const api = await fetch(base + "/api/health", { redirect: "manual" });
  assert.equal(api.status, 401);
  for (const route of ["/login"]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Continue with Google/);
    assert.match(html, /type="password"/);
    assert.match(html, /PrepYard password/);
    assert.doesNotMatch(html, /Data sources|dataset dates|import history/);
  }
  const confirmation = await fetch(base + "/signup", {
    redirect: "manual",
  });
  assert.equal(confirmation.status, 200);
  assert.match(await confirmation.text(), /Create your PrepYard account/);
  for (const route of ["/forgot-password", "/verify-email", "/reset-password"])
    assert.equal((await fetch(base + route)).status, 200);
  const oauth = await fetch(base + "/api/auth/signin/google", {
    redirect: "manual",
  });
  assert.equal(oauth.status, 503);
  const oldConfirmation = await fetch(
    base + "/auth/confirm?token_hash=invalid",
    { redirect: "manual" },
  );
  assert.equal(oldConfirmation.status, 307);
  console.log(
    "Account access checks passed: protected routes, APIs, forged cookie denial, Google entry point, separate PrepYard password forms, and missing configuration.",
  );
} finally {
  server.kill();
}
