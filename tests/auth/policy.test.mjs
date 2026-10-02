import test from "node:test";
import assert from "node:assert/strict";
import {
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
