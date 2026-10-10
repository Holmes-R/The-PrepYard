import test from "node:test";
import assert from "node:assert/strict";
import { studentNotes } from "../../src/features/notes/queries.mjs";
test("notebook searches title and content with bounded literal input on both page queries", async () => {
  const calls = [];
  const client = {
    query: async (sql, args) => {
      calls.push({ sql, args });
      return { rows: sql.startsWith("select count") ? [{ total: 26 }] : [] };
    },
  };
  const result = await studentNotes(client, 2, " %_' OR 1=1 -- ");
  assert.deepEqual([result.total, result.page, result.pages], [26, 2, 2]);
  for (const call of calls) {
    assert.match(call.sql, /n.user_id=private.student_id\(\)/);
    assert.match(call.sql, /strpos\(lower\(q.title\),lower\(\$1\)\)/);
    assert.match(call.sql, /strpos\(lower\(n.content\),lower\(\$1\)\)/);
    assert.equal(call.args[0], "%_' OR 1=1 --");
    assert.ok(!call.sql.includes("OR 1=1 --"));
  }
  assert.deepEqual(calls[1].args.slice(1), [24, 24]);
  await studentNotes(client, -2, "x".repeat(201));
  assert.equal(calls[2].args[0].length, 200);
});
