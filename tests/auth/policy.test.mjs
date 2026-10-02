import test from "node:test";
import assert from "node:assert/strict";
import {
  authConfigured,
  googleConfigured,
  safeDestination,
  verifiedGoogleIdentity,
  validStudentId,
} from "../../src/lib/auth/policy.mjs";
test("all required Google/database configuration must exist", () => {
  const env = {
    AUTH_SECRET: "secret",
    AUTH_GOOGLE_ID: "id",
    AUTH_GOOGLE_SECRET: "secret",
    DATABASE_URL: "url",
  };
  assert.equal(googleConfigured(env), true);
  for (const key of Object.keys(env))
    assert.equal(googleConfigured({ ...env, [key]: "" }), false, key);
});
test("only a verified Google subject may create an identity", () => {
  const profile = {
    sub: "12345",
    email: "student@example.test",
    email_verified: true,
  };
  const account = { provider: "google", providerAccountId: "12345" };
  assert.equal(verifiedGoogleIdentity(profile, account), true);
  for (const changed of [
    { ...profile, email_verified: false },
    { ...profile, email_verified: "true" },
    { ...profile, sub: "different" },
    { ...profile, email: "" },
    undefined,
  ])
    assert.equal(verifiedGoogleIdentity(changed, account), false);
  assert.equal(
    verifiedGoogleIdentity(profile, { ...account, provider: "credentials" }),
    false,
  );
});
test("callback destinations cannot escape the application or loop into auth", () => {
  for (const input of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/%2f%2fevil.test",
    "/%5cevil.test",
    "/login",
    "/signup",
    "/verify-email",
    "/reset-password",
    "/forgot-password",
    "/api/auth/callback/google",
    "/../login",
    null,
    "/%ZZ",
    "/\nevil.test",
  ])
    assert.equal(safeDestination(input), "/dashboard", String(input));
  assert.equal(
    safeDestination("/companies?difficulty=medium"),
    "/companies?difficulty=medium",
  );
});
test("only internal UUIDs identify students", () => {
  assert.equal(validStudentId("11111111-1111-4111-8111-111111111111"), true);
  for (const value of ["google-subject", "student@example.test", "", null])
    assert.equal(validStudentId(value), false);
});

test("immutable authentication redirects can receive private cache headers", async () => {
  const { privateAuthResponse } =
    await import("../../src/lib/auth/response.mjs");
  const original = Response.redirect("http://localhost:3000/login", 302);
  assert.throws(
    () => original.headers.set("Cache-Control", "no-store"),
    TypeError,
  );
  const response = privateAuthResponse(original);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "http://localhost:3000/login");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});
test("auth response copying preserves separate cookies and response content", async () => {
  const { privateAuthResponse } =
    await import("../../src/lib/auth/response.mjs");
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", "authjs.session-token=token; HttpOnly; Path=/");
  headers.append(
    "Set-Cookie",
    "authjs.csrf-token=csrf; Expires=Wed, 01 Jan 2030 00:00:00 GMT; Path=/",
  );
  const original = new Response('{"ok":true}', { status: 200, headers });
  const response = privateAuthResponse(original);
  assert.deepEqual(
    response.headers.getSetCookie(),
    original.headers.getSetCookie(),
  );
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.deepEqual(await response.json(), { ok: true });
});

test("password access does not depend on Google configuration", () => {
  assert.equal(
    authConfigured({ AUTH_SECRET: "test", DATABASE_URL: "test" }),
    true,
  );
  assert.equal(authConfigured({ AUTH_SECRET: "test" }), false);
  assert.equal(authConfigured({ DATABASE_URL: "test" }), false);
});
