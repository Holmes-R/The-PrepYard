import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEmail,
  validPassword,
  hashPassword,
  verifyPassword,
  newEmailToken,
  tokenDigest,
  validEmailToken,
} from "../../src/lib/auth/password.mjs";
test("email normalization and password boundaries", () => {
  assert.equal(normalizeEmail(" Student@Gmail.com "), "student@gmail.com");
  for (const v of [null, "x", "x@y", "a b@gmail.com"])
    assert.equal(normalizeEmail(v), null);
  assert.equal(validPassword("a".repeat(11)), false);
  assert.equal(validPassword("a".repeat(12)), true);
  assert.equal(validPassword("a".repeat(128)), true);
  assert.equal(validPassword("a".repeat(129)), false);
});
test("salted password hashes verify only the exact password", async () => {
  const password = "correct horse battery staple";
  const first = await hashPassword(password),
    second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(
    await verifyPassword("incorrect horse battery staple", first),
    false,
  );
  assert.equal(await verifyPassword(password, null), false);
  assert.equal(await verifyPassword(password, "scrypt$broken"), false);
  await assert.rejects(hashPassword("short"));
});
test("email tokens are random and only their digest is stored", () => {
  const first = newEmailToken(),
    second = newEmailToken();
  assert.ok(validEmailToken(first.token));
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.token, first.digest);
  assert.equal(first.digest, tokenDigest(first.token));
  for (const v of [null, "", first.token + "x"])
    assert.equal(validEmailToken(v), false);
});
