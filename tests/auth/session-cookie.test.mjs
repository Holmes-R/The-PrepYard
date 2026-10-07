import test from "node:test";
import assert from "node:assert/strict";
import {
  sessionCookieNames,
  withoutSessionCookies,
} from "../../src/lib/auth/session-cookie.mjs";
test("session cleanup identifies exact plain/secure cookies and numbered chunks", () => {
  const cookies = [
    "authjs.session-token",
    "authjs.session-token.0",
    "authjs.session-token.12",
    "authjs.session-token.other",
    "__Secure-authjs.session-token",
    "__Secure-authjs.session-token.1",
    "authjs.csrf-token",
  ].map((name) => ({ name }));
  assert.deepEqual(sessionCookieNames(cookies, false), [
    "authjs.session-token",
    "authjs.session-token.0",
    "authjs.session-token.12",
  ]);
  assert.deepEqual(sessionCookieNames(cookies, true), [
    "__Secure-authjs.session-token",
    "__Secure-authjs.session-token.1",
  ]);
});
test("cleanup preserves CSRF, callback and unrelated cookies, including equals in values", () => {
  assert.equal(
    withoutSessionCookies(
      "authjs.session-token.0=bad; authjs.csrf-token=a=b; preference=dark; authjs.session-token.1=bad; authjs.callback-url=%2Fdashboard",
      ["authjs.session-token.0", "authjs.session-token.1"],
    ),
    "authjs.csrf-token=a=b; preference=dark; authjs.callback-url=%2Fdashboard",
  );
  assert.equal(withoutSessionCookies(null, []), "");
  assert.equal(
    withoutSessionCookies("authjs.session-token=bad", ["authjs.session-token"]),
    "",
  );
});
