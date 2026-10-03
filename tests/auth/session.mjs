import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { encode } from "next-auth/jwt";
const root = fileURLToPath(new URL("../../", import.meta.url));
const base = "http://127.0.0.1:3113";
const secret = randomBytes(32).toString("base64url");
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3113",
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      AUTH_URL: base,
      AUTH_SECRET: secret,
      AUTH_GOOGLE_ID: "test-client",
      AUTH_GOOGLE_SECRET: "test-client-secret",
      DATABASE_URL: "postgresql://prepyard_web:unused@127.0.0.1:1/unreachable",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
server.stdout.on("data", (data) => {
  output += data;
});
server.stderr.on("data", (data) => {
  output += data;
});
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
  const userId = randomUUID();
  const salt = "authjs.session-token";
  const token = {
    studentId: userId,
    sub: userId,
    email: "student@example.test",
    name: "Test Student",
  };
  const cookie = await encode({ secret, salt, token, maxAge: 3600 });
  const options = {
    redirect: "manual",
    headers: { Cookie: `${salt}=${cookie}` },
  };
  for (const route of ["/", "/companies", "/dashboard", "/notes"]) {
    assert.equal(
      (await fetch(base + route, options)).status,
      307,
      "Legacy Google session denied",
    );
  }
  assert.equal((await fetch(base + "/api/health", options)).status, 401);
  const session = await (
    await fetch(base + "/api/auth/session", options)
  ).json();
  assert.ok(!session?.user, "Legacy session cannot authenticate");
  const expired = await encode({ secret, salt, token, maxAge: -60 });
  const foreign = await encode({
    secret: "different-secret",
    salt,
    token,
    maxAge: 3600,
  });
  for (const invalid of [cookie.slice(0, -8) + "tampered", expired, foreign]) {
    const response = await fetch(base + "/api/health", {
      redirect: "manual",
      headers: { Cookie: `${salt}=${invalid}` },
    });
    assert.equal(
      response.status,
      401,
      "Invalid session cannot reach protected endpoint",
    );
  }
  const legacy = await fetch(base + "/auth/confirm?token_hash=unused", options);
  assert.equal(legacy.status, 307, "Legacy session cannot reach removed route");
  const signInRedirect = await fetch(base + "/api/auth/signin", {
    redirect: "manual",
  });
  assert.ok(
    [302, 303, 307].includes(signInRedirect.status),
    "Auth GET redirect must not throw immutable header error",
  );
  assert.equal(
    new URL(signInRedirect.headers.get("location"), base).pathname,
    "/login",
  );
  assert.equal(
    signInRedirect.headers.get("cache-control"),
    "private, no-store",
  );
  const csrfResponse = await fetch(base + "/api/auth/csrf", options);
  const { csrfToken } = await csrfResponse.json();
  const csrfCookies = csrfResponse.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const signOutResponse = await fetch(base + "/api/auth/signout", {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: options.headers.Cookie + "; " + csrfCookies,
    },
    body: new URLSearchParams({ csrfToken, callbackUrl: base + "/login" }),
  });
  assert.ok(
    [302, 303, 307].includes(signOutResponse.status),
    "Auth POST redirect must not throw immutable header error",
  );
  assert.equal(
    signOutResponse.headers.get("cache-control"),
    "private, no-store",
  );
  assert.ok(
    signOutResponse.headers
      .getSetCookie()
      .some((value) => value.startsWith("authjs.session-token=;")),
    "Sign-out must preserve cookie deletion",
  );
  const providers = await (await fetch(base + "/api/auth/providers")).json();
  assert.deepEqual(Object.keys(providers).sort(), ["credentials"]);
  console.log(
    "Session checks passed: legacy Google/expired/tampered/foreign tokens denied, credentials-only provider, private redirects and sign-out.",
  );
} finally {
  server.kill();
}
