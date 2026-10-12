import test from "node:test";
import assert from "node:assert/strict";
import {
  cacheEvent,
  instrumentDatabaseClient,
  measure,
  withServerTiming,
} from "../../src/lib/performance/timing.mjs";

test("timing preserves immutable response headers and measures failed queries too", async () => {
  const client = instrumentDatabaseClient({
    query: async () => {
      throw Error("database offline");
    },
  });
  const result = await withServerTiming(async () => {
    await measure("pool", async () => true);
    await measure("auth", async () => true);
    await assert.rejects(client.query("SECRET SQL", ["PRIVATE PASSWORD"]));
    cacheEvent("miss");
    return Response.redirect("https://example.com/login", 307);
  });
  assert.equal(result.status, 307);
  assert.equal(result.headers.get("location"), "https://example.com/login");
  assert.match(result.headers.get("server-timing"), /1 queries/);
  assert.match(
    result.headers.get("server-timing"),
    /0 hits, 1 misses, 0 waits/,
  );
  assert.doesNotMatch(result.headers.get("server-timing"), /SECRET|PRIVATE/);
});
test("simultaneous requests keep their query and cache counters separate", async () => {
  const client = instrumentDatabaseClient({
    query: async () => ({ rows: [] }),
  });
  const request = (count) =>
    withServerTiming(async () => {
      for (let i = 0; i < count; i++) {
        await client.query("query");
        cacheEvent("hit");
      }
      return Response.json(
        { ok: true },
        { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
      );
    });
  const [one, three] = await Promise.all([request(1), request(3)]);
  assert.match(one.headers.get("server-timing"), /1 queries/);
  assert.match(three.headers.get("server-timing"), /3 queries/);
  assert.match(three.headers.get("server-timing"), /3 hits/);
  assert.equal(one.headers.get("cache-control"), "private, no-store");
  assert.equal(one.headers.get("vary"), "Cookie");
  assert.deepEqual(await one.json(), { ok: true });
});
test("database proxy preserves callbacks and client method bindings", async () => {
  const original = {
    released: false,
    query(sql, callback) {
      queueMicrotask(() => callback(null, { rows: [1] }));
    },
    release() {
      this.released = true;
    },
  };
  const client = instrumentDatabaseClient(original);
  const response = await withServerTiming(async () => {
    const rows = await new Promise((resolve, reject) =>
      client.query("callback", (error, result) =>
        error ? reject(error) : resolve(result.rows),
      ),
    );
    assert.deepEqual(rows, [1]);
    client.release();
    return Response.json(rows);
  });
  assert.equal(original.released, true);
  assert.match(response.headers.get("server-timing"), /1 queries/);
});
test("optional performance logs contain counters, never SQL or parameter values", async () => {
  const previous = process.env.PREPYARD_PERFORMANCE_LOG;
  const log = console.info,
    output = [];
  process.env.PREPYARD_PERFORMANCE_LOG = "1";
  console.info = (line) => output.push(line);
  try {
    await withServerTiming(async () => {
      const client = instrumentDatabaseClient({
        query: async () => ({ rows: [] }),
      });
      await client.query("SECRET_SQL", ["SECRET_PASSWORD", "NOTE_CONTENT"]);
      return Response.json({ ok: true });
    }, "company-sheet");
  } finally {
    console.info = log;
    if (previous === undefined) delete process.env.PREPYARD_PERFORMANCE_LOG;
    else process.env.PREPYARD_PERFORMANCE_LOG = previous;
  }
  assert.equal(output.length, 1);
  assert.equal(JSON.parse(output[0]).queries, 1);
  assert.doesNotMatch(output[0], /SECRET|NOTE_CONTENT/);
});
