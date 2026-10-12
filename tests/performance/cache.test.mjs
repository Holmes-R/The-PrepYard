import test from "node:test";
import assert from "node:assert/strict";
import { createCatalogueCache } from "../../src/features/catalogue/cache.mjs";
import {
  companySheet,
  filtersFrom,
} from "../../src/features/catalogue/queries.mjs";

test("metadata expires after a fixed TTL and callers cannot mutate shared values", async () => {
  let clock = 0,
    loads = 0;
  const cache = createCatalogueCache({ ttlMs: 60, now: () => clock });
  const load = async () => [{ slug: "arrays", name: "Arrays", total: ++loads }];
  const first = await cache.read("topics", load);
  first[0].name = "private change";
  clock = 59;
  assert.equal((await cache.read("topics", load))[0].name, "Arrays");
  clock = 60;
  assert.equal((await cache.read("topics", load))[0].total, 2);
});
test("concurrent reads deduplicate, failures retry, null misses do not linger", async () => {
  let loads = 0;
  const events = [];
  const cache = createCatalogueCache({
    onEvent: (event) => events.push(event),
  });
  const load = async () => {
    loads++;
    return { name: "Shared" };
  };
  assert.deepEqual(
    await Promise.all([cache.read("x", load), cache.read("x", load)]),
    [{ name: "Shared" }, { name: "Shared" }],
  );
  assert.equal(loads, 1);
  assert.deepEqual(events, ["miss", "wait"]);
  await assert.rejects(
    cache.read("failed", async () => {
      throw Error("offline");
    }),
  );
  assert.deepEqual(await cache.read("failed", load), { name: "Shared" });
  for (let i = 0; i < 2; i++)
    await cache.read("absent", async () => {
      loads++;
      return null;
    });
  assert.equal(loads, 4);
});
test("bounded eviction and clear also invalidate pending loads", async () => {
  const cache = createCatalogueCache({ capacity: 1 });
  let loads = 0;
  const load = async () => ({ total: ++loads });
  await cache.read("a", load);
  await cache.read("b", load);
  await cache.read("a", load);
  assert.equal(loads, 3);
  let release;
  const pending = cache.read(
    "pending",
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await Promise.resolve();
  cache.clear();
  release({ total: 10 });
  await pending;
  assert.equal((await cache.read("pending", load)).total, 4);
});
test("personal fields can never be stored as shared catalogue metadata", async () => {
  const cache = createCatalogueCache();
  for (const key of [
    "solved",
    "solved_count",
    "status",
    "user_id",
    "content",
    "tags",
    "revision",
    "confidence",
    "email",
  ]) {
    await assert.rejects(
      cache.read(key, async () => ({
        topics: [{ slug: "arrays", [key]: "private" }],
      })),
      /Non-catalogue field/,
    );
  }
});
test("warm company metadata reduces catalogue reads to one while progress stays fresh", async () => {
  const cache = createCatalogueCache();
  let reads = 0,
    solved = 0;
  const client = {
    query: async () => {
      reads++;
      return {
        rows: [
          {
            total: 1,
            solved,
            page: 1,
            pages: 1,
            easy_count: 1,
            medium_count: 0,
            hard_count: 0,
            rows: [],
          },
        ],
      };
    },
  };
  const metadata = () =>
    cache.read("acme", async () => {
      reads++;
      return {
        company: { id: "id", slug: "acme", name: "Acme" },
        available: ["all"],
        topics: [],
      };
    });
  assert.equal(
    (await companySheet(client, "acme", filtersFrom(), metadata)).solved,
    0,
  );
  assert.equal(reads, 2);
  solved = 1;
  reads = 0;
  assert.equal(
    (await companySheet(client, "acme", filtersFrom(), metadata)).solved,
    1,
  );
  assert.equal(reads, 1);
});
