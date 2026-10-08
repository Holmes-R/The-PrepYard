import test from "node:test";
import assert from "node:assert/strict";
import { patternHref } from "../../src/features/patterns/navigation.mjs";
test("pattern links use dedicated routes and preserve encoded filters", () => {
  assert.equal(patternHref("prefix-sum"), "/patterns/prefix-sum");
  assert.equal(
    patternHref(
      "two-pointers",
      new URLSearchParams({ pattern: "other", q: "a & b", sort: "revision" }),
    ),
    "/patterns/two-pointers?q=a+%26+b&sort=revision",
  );
  for (const slug of ["../notes", "//example.com", "a?b", "a/b", ""])
    assert.throws(() => patternHref(slug));
});
