import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanOrder,
  parseOrder,
  toggleOrder,
  orderSql,
  difficultyExpression,
  effectiveOrder,
} from "../../src/features/questions/sorting.mjs";
import {
  patternQuestions,
  patternFilters,
} from "../../src/features/patterns/queries.mjs";
import {
  filtersFrom,
  filtersToParams,
} from "../../src/features/catalogue/queries.mjs";
test("ranked sorting rejects injection, duplicate columns, unsupported directions and more than three priorities", () => {
  assert.equal(
    cleanOrder("revision-asc,difficulty-desc,title-asc,frequency-desc"),
    "revision-asc,difficulty-desc,title-asc",
  );
  assert.equal(
    cleanOrder(
      "title-asc,title-desc,difficulty-up,q.id desc;drop table students",
    ),
    "title-asc",
  );
  assert.equal(
    patternFilters({ order: "frequency-desc,difficulty-asc" }).order,
    "difficulty-asc",
  );
  assert.equal(parseOrder({}).length, 0);
  assert.equal(cleanOrder("topic-asc,difficulty-desc"), "difficulty-desc");
  assert.equal(
    filtersFrom({ order: "topic-desc,revision-asc" }).order,
    "revision-asc",
  );
  assert.equal(
    patternFilters({ order: "topic-asc,title-desc" }).order,
    "title-desc",
  );
});
test("header cycling preserves priority and caps selection at three columns", () => {
  let order = toggleOrder("", "difficulty");
  assert.equal(order, "difficulty-asc");
  order = toggleOrder(order, "revision");
  assert.equal(order, "difficulty-asc,revision-asc");
  order = toggleOrder(order, "difficulty");
  assert.equal(order, "difficulty-desc,revision-asc");
  order = toggleOrder(order, "difficulty");
  assert.equal(order, "revision-asc");
  assert.equal(
    toggleOrder("revision-asc,title-asc,frequency-desc", "difficulty"),
    "revision-asc,title-asc,difficulty-asc",
  );
  assert.equal(effectiveOrder(undefined, "frequency-desc"), "frequency-desc");
});
test("URLs preserve filters, priorities and paging across company navigation", () => {
  const filters = filtersFrom({
    order: "difficulty-desc,revision-asc",
    topics: ["array", "hash-table"],
    page: "2",
  });
  const params = filtersToParams(filters, "acme");
  assert.equal(params.get("order"), "difficulty-desc,revision-asc");
  assert.equal(params.get("open"), "acme");
  assert.deepEqual(params.getAll("topics"), ["array", "hash-table"]);
  assert.equal(params.get("page"), "2");
});
test("SQL honors priority, keeps unknown difficulty last and uses deterministic ties", () => {
  const sql = orderSql("difficulty-desc,title-asc", {
    difficulty: [difficultyExpression],
    title: ["lower(q.title)"],
  });
  assert.match(
    sql,
    /end desc nulls last,lower\(q.title\) asc nulls last,lower\(q.title\),q.id$/,
  );
  assert.equal(orderSql("q.id desc", {}), "");
});
test("custom order overrides legacy collection order without adding unused PostgreSQL parameters", async () => {
  for (const collection of ["", "interview-hotlist", "dsa-deep-dive"]) {
    const calls = [],
      client = {
        query: async (sql, args) => {
          calls.push({ sql, args: [...args] });
          return { rows: calls.length === 1 ? [{ total: 3, solved: 0 }] : [] };
        },
      };
    await patternQuestions(
      client,
      patternFilters({ collection, order: "revision-asc,difficulty-desc" }),
    );
    for (const call of calls)
      assert.equal(
        call.args.length,
        new Set([...call.sql.matchAll(/\$(\d+)/g)].map((m) => m[1])).size,
      );
    assert.match(calls[1].sql, /order by case when u.next_revision_at/);
    assert.match(calls[1].sql, /end desc nulls last/);
  }
});
