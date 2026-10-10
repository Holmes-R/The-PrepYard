import test from "node:test";
import assert from "node:assert/strict";
import { sameOriginMutation } from "../../src/features/leetcode/request-policy.mjs";
test("mutations compare the browser Origin against the incoming host behind Next's internal hostname", () => {
  const request = {
    url: "http://localhost:3117/api/integrations/leetcode",
    headers: new Headers({
      Host: "127.0.0.1:3117",
      Origin: "http://127.0.0.1:3117",
    }),
  };
  assert.equal(sameOriginMutation(request), true);
  request.headers.set("Origin", "https://other.example");
  assert.equal(sameOriginMutation(request), false);
  request.headers.delete("Origin");
  assert.equal(sameOriginMutation(request), false);
});
test("forwarded HTTPS is supported without trusting a caller-provided forwarded host", () => {
  const request = {
    url: "http://internal:3000/api/integrations/leetcode",
    headers: new Headers({
      Host: "prepyard.example",
      Origin: "https://prepyard.example",
      "X-Forwarded-Proto": "https",
    }),
  };
  assert.equal(sameOriginMutation(request), true);
  request.headers.set("Origin", "https://attacker.example");
  request.headers.set("X-Forwarded-Host", "attacker.example");
  assert.equal(sameOriginMutation(request), false);
  request.headers.set("Origin", "null");
  assert.equal(sameOriginMutation(request), false);
});
