import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  parseHistory,
  readHistoryRequest,
  MAX_HISTORY_BYTES,
} from "../../src/features/leetcode/history.mjs";
import {
  normalizePrepYardOrigin,
  readSolvedInLeetCodeTab,
  inPrepYardTab,
} from "../../extensions/leetcode-sync/browser-api.mjs";
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/solved-history.json", import.meta.url),
    "utf8",
  ),
);
const bindingVersion = "ee032664-d5db-4fd0-8c34-4469056f9fe8";
const expectedSlugs = [
  "two-sum",
  "valid-parentheses",
  "contains-duplicate",
  "best-time-to-buy-and-sell-stock",
  "maximum-subarray",
  "merge-intervals",
  "rotate-array",
  "move-zeroes",
  "majority-element",
  "sort-colors",
  "three-sum",
  "product-of-array-except-self",
  "container-with-most-water",
  "trapping-rain-water",
  "subarray-sum-equals-k",
  "reverse-linked-list",
  "linked-list-cycle",
  "climbing-stairs",
  "binary-search",
  "search-insert-position",
  "missing-number",
  "single-number",
  "not-in-prepyard",
  "second-unknown-question",
];
test("complete browser list exceeds public 20 limit; only accepted slugs leave the tab", async () => {
  const originalFetch = globalThis.fetch,
    originalLocation = globalThis.location;
  try {
    globalThis.location = { origin: "https://leetcode.com" };
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://leetcode.com/api/problems/all/");
      assert.equal(options.credentials, "same-origin");
      assert.equal(options.headers, undefined);
      return Response.json({
        ...fixture,
        session_cookie: "must not be returned",
        solutionCode: "must not be returned",
      });
    };
    assert.deepEqual(await readSolvedInLeetCodeTab(), {
      username: "fixture_student",
      total: 24,
      slugs: expectedSlugs,
    });
    for (const bad of [
      { ...fixture, user_name: "" },
      { ...fixture, num_solved: 25 },
      {
        ...fixture,
        stat_status_pairs: [
          { status: "ac", stat: { question__title_slug: "https://evil.test" } },
        ],
      },
    ]) {
      globalThis.fetch = async () => Response.json(bad);
      assert.ok((await readSolvedInLeetCodeTab()).syncError);
    }
    globalThis.location = { origin: "https://evil.test" };
    assert.ok((await readSolvedInLeetCodeTab()).syncError);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLocation === undefined) delete globalThis.location;
    else globalThis.location = originalLocation;
  }
});
test("history validation rejects partial, duplicate, oversized, credential-bearing or malformed imports", async () => {
  const body = {
    schema: 1,
    username: "fixture_student",
    bindingVersion,
    total: 24,
    slugs: expectedSlugs,
  };
  assert.deepEqual(parseHistory(body), body);
  assert.equal(parseHistory({ ...body, total: 0, slugs: [] }).total, 0);
  for (const bad of [
    { ...body, total: 25 },
    { ...body, slugs: [...expectedSlugs.slice(0, 23), "two-sum"] },
    { ...body, password: "secret" },
    { ...body, bindingVersion: "bad" },
    { ...body, total: 20001 },
    { ...body, slugs: expectedSlugs.map(() => "../secret") },
    { ...body, username: "a@example.test" },
  ])
    assert.throws(() => parseHistory(bad));
  assert.deepEqual(
    await readHistoryRequest(
      new Request("https://prep.test", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    ),
    body,
  );
  await assert.rejects(
    readHistoryRequest(
      new Request("https://prep.test", { method: "POST", body: "{bad" }),
    ),
  );
  await assert.rejects(
    readHistoryRequest(
      new Request("https://prep.test", {
        method: "POST",
        body: "x",
        headers: { "content-length": String(MAX_HISTORY_BYTES + 1) },
      }),
    ),
    (error) => error.status === 413,
  );
});
test("streamed payloads are bounded even without a Content-Length header", async () => {
  const request = new Request("https://prep.test", {
    method: "POST",
    body: new Uint8Array(MAX_HISTORY_BYTES + 1),
  });
  assert.equal(request.headers.has("content-length"), false);
  await assert.rejects(
    readHistoryRequest(request),
    (error) => error.status === 413,
  );
});
test("only secure or local PrepYard origins may be granted; paths and embedded credentials are rejected", () => {
  assert.equal(
    normalizePrepYardOrigin("http://localhost:3000"),
    "http://localhost:3000",
  );
  assert.equal(
    normalizePrepYardOrigin("https://prepyard.example/"),
    "https://prepyard.example",
  );
  for (const value of [
    "https://user:password@prep.test",
    "http://evil.test",
    "https://prep.test/path",
    "https://prep.test/?password=secret",
    "javascript:alert(1)",
  ])
    assert.throws(() => normalizePrepYardOrigin(value));
});
test("PrepYard bridge is bound to the exact tab origin and surfaces login failures", async () => {
  const previousFetch = globalThis.fetch,
    previousLocation = globalThis.location;
  try {
    globalThis.location = { origin: "https://prep.test" };
    let fetched = 0;
    globalThis.fetch = async () => {
      fetched++;
      return new Response(null, { status: 401 });
    };
    assert.match(
      (await inPrepYardTab("https://evil.test", "profile")).syncError,
      /changed/,
    );
    assert.equal(fetched, 0);
    assert.match(
      (await inPrepYardTab("https://prep.test", "profile")).syncError,
      /Log in/,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousLocation === undefined) delete globalThis.location;
    else globalThis.location = previousLocation;
  }
});
