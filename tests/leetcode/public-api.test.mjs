import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeUsername,
  parsePublicAccepted,
  fetchPublicAccepted,
  LEETCODE_ENDPOINT,
  SYNC_INTERVAL_MS,
} from "../../src/features/leetcode/public-api.mjs";
const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/recent-accepted.json", import.meta.url)),
);
const expected = [
  { id: "987654321", slug: "two-sum", submittedAt: "2024-07-03T09:46:40.000Z" },
  {
    id: "987654322",
    slug: "valid-parentheses",
    submittedAt: "2024-07-03T09:48:20.000Z",
  },
  {
    id: "987654323",
    slug: "not-in-prepyard",
    submittedAt: "2024-07-03T09:50:00.000Z",
  },
];
test("independent accepted fixture is parsed exactly and duplicate submissions collapse", () => {
  assert.deepEqual(parsePublicAccepted(fixture, "FIXTURE_STUDENT"), {
    username: "fixture_student",
    submissions: expected,
  });
  assert.equal(SYNC_INTERVAL_MS, 120000);
});
test("usernames are bounded identifiers, never URLs, emails, paths, or queries", () => {
  assert.equal(normalizeUsername(" user_123-abc "), "user_123-abc");
  for (const value of [
    null,
    {},
    "",
    "a@b.com",
    "https://x",
    "../admin",
    "user/name",
    "foo\nbar",
    "a".repeat(41),
  ])
    assert.equal(normalizeUsername(value), null);
});
test("missing profiles, changed upstream schemas, wrong profiles and GraphQL errors fail closed", () => {
  assert.throws(
    () =>
      parsePublicAccepted({ data: { matchedUser: null } }, "fixture_student"),
    (error) => error.status === 422,
  );
  for (const data of [
    null,
    {},
    { errors: [{ message: "Blocked" }], data: fixture.data },
    { data: { ...fixture.data, matchedUser: { username: "someone_else" } } },
    { data: { ...fixture.data, recentAcSubmissionList: null } },
  ])
    assert.throws(() => parsePublicAccepted(data, "fixture_student"));
  for (const invalid of [
    { id: "invalid" },
    { titleSlug: "../../admin" },
    { timestamp: "tomorrow" },
    { timestamp: -1 },
    { statusDisplay: "Wrong Answer" },
  ]) {
    const body = structuredClone(fixture);
    Object.assign(body.data.recentAcSubmissionList[0], invalid);
    assert.throws(() => parsePublicAccepted(body, "fixture_student"));
  }
});
test("conflicting duplicate identities and overlarge result lists are rejected", () => {
  const body = structuredClone(fixture);
  body.data.recentAcSubmissionList[3].titleSlug = "other-question";
  assert.throws(() => parsePublicAccepted(body, "fixture_student"));
  body.data.recentAcSubmissionList = Array.from({ length: 21 }, (_, i) => ({
    id: String(i + 1),
    titleSlug: "two-sum",
    timestamp: 1720000000,
  }));
  assert.throws(() => parsePublicAccepted(body, "fixture_student"));
});
test("request is server-side, bounded, credential-free and uses only the fixed public endpoint", async () => {
  const result = await fetchPublicAccepted("fixture_student", {
    fetcher: async (url, options) => {
      assert.equal(url, LEETCODE_ENDPOINT);
      assert.equal(url, "https://leetcode.com/graphql/");
      assert.equal(options.redirect, "error");
      assert.equal(options.cache, "no-store");
      assert.equal(options.headers.Cookie, undefined);
      assert.equal(options.headers.Authorization, undefined);
      const body = JSON.parse(options.body);
      assert.deepEqual(body.variables, {
        username: "fixture_student",
        limit: 20,
      });
      assert.match(body.query, /recentAcSubmissionList/);
      assert.doesNotMatch(body.query, /submissionDetail|code|password/);
      assert.ok(options.signal);
      return Response.json(fixture);
    },
  });
  assert.deepEqual(result.submissions, expected);
});
test("rate limits, HTML challenges, timeouts and network failures keep progress untouched", async () => {
  for (const fetcher of [
    async () => new Response("blocked", { status: 429 }),
    async () => new Response("<html>challenge</html>"),
    async () => {
      throw Error("network");
    },
  ]) {
    await assert.rejects(
      fetchPublicAccepted("fixture_student", { fetcher }),
      (error) =>
        error.status === 503 && /temporarily unavailable/.test(error.message),
    );
  }
});
