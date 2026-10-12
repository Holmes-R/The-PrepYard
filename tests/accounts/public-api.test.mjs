import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeGfgUsername,
  parseGfgSnapshot,
  fetchGfgSnapshot,
  AccountSyncError,
  GFG_SUBMISSIONS,
} from "../../src/features/accounts/public-api.mjs";
const profile = {
  data: { practice_course_visibility: true, total_problems_solved: 2 },
};
const submissions = {
  status: "success",
  result: {
    Easy: {
      101: { slug: "attend-all-meetings", user_subtime: "2025-01-01 12:00:00" },
    },
    Medium: { 102: { slug: "largest-bst" } },
  },
};
test("only usernames can select an upstream account", () => {
  assert.equal(normalizeGfgUsername(" student_123 "), "student_123");
  for (const bad of [
    "https://example.com",
    "../other",
    "a@b.com",
    "a?handle=b",
    "x".repeat(61),
    null,
  ])
    assert.equal(normalizeGfgUsername(bad), null);
});
test("public solved lists are normalized without guessing an undocumented timezone", () => {
  assert.deepEqual(parseGfgSnapshot(profile, submissions, "student"), {
    username: "student",
    slugs: ["attend-all-meetings", "largest-bst"],
  });
  assert.deepEqual(
    parseGfgSnapshot(
      { data: { practice_course_visibility: true, total_problems_solved: 0 } },
      { status: "success", result: {} },
      "student",
    ).slugs,
    [],
  );
});
test("private, incomplete, duplicate and invalid snapshots fail closed", () => {
  assert.throws(
    () =>
      parseGfgSnapshot(
        { data: { ...profile.data, practice_course_visibility: false } },
        submissions,
        "student",
      ),
    (error) => error.status === 422,
  );
  for (const bad of [
    null,
    { status: "failed", result: {} },
    { status: "success", result: [] },
    { status: "success", result: { Medium: { 1: { slug: "largest-bst" } } } },
    {
      status: "success",
      result: {
        Easy: { 1: { slug: "largest-bst" }, 2: { slug: "largest-bst" } },
      },
    },
    { status: "success", result: { Unknown: { 1: { slug: "largest-bst" } } } },
    { status: "success", result: { Easy: { 1: { slug: "../login" } } } },
  ])
    assert.throws(
      () => parseGfgSnapshot(profile, bad, "student"),
      AccountSyncError,
    );
});
test("adapter uses only fixed GFG hosts and public requests with no credentials", async () => {
  const calls = [];
  const result = await fetchGfgSnapshot("student", {
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return Response.json(calls.length === 1 ? profile : submissions);
    },
  });
  assert.equal(result.slugs.length, 2);
  assert.equal(new URL(calls[0].url).hostname, "authapi.geeksforgeeks.org");
  assert.equal(calls[1].url, GFG_SUBMISSIONS);
  assert.equal(
    calls[1].options.headers.Origin,
    "https://www.geeksforgeeks.org",
  );
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    handle: "student",
    requestType: "",
    year: "",
    month: "",
  });
  for (const { options } of calls) {
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers.Cookie, undefined);
  }
});
test("missing profile and blocked upstream responses never look like an empty solved list", async () => {
  await assert.rejects(
    fetchGfgSnapshot("student", {
      fetcher: async () => new Response("Missing", { status: 404 }),
    }),
    (error) => error.status === 422,
  );
  await assert.rejects(
    fetchGfgSnapshot("student", {
      fetcher: async () => new Response("Blocked", { status: 403 }),
    }),
    (error) => error.status === 503,
  );
  await assert.rejects(
    fetchGfgSnapshot("student", {
      fetcher: async () => new Response("<html>Sign in</html>"),
    }),
    AccountSyncError,
  );
  await assert.rejects(
    fetchGfgSnapshot("student", {
      fetcher: async () => {
        throw new Error("timeout");
      },
    }),
    AccountSyncError,
  );
});
test("oversized streamed data is rejected without trusting Content-Length", async () => {
  await assert.rejects(
    fetchGfgSnapshot("student", {
      fetcher: async () => new Response("x".repeat(2_000_001)),
    }),
    AccountSyncError,
  );
});
