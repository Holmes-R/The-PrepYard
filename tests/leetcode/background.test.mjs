import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("full-history confirmation does not wait for stalled public checks or toolbar badges", async () => {
  const previousChrome = globalThis.chrome,
    previousTimeout = globalThis.setTimeout;
  const fixture = JSON.parse(
    readFileSync(
      new URL("./fixtures/solved-history.json", import.meta.url),
      "utf8",
    ),
  );
  const slugs = fixture.stat_status_pairs
    .filter((row) => row.status === "ac")
    .map((row) => row.stat.question__title_slug);
  const stored = {},
    calls = [];
  let alarmCleared = false;
  let receive;
  const profile = {
    username: "fixture_student",
    enabled: true,
    binding_version: "ee032664-d5db-4fd0-8c34-4469056f9fe8",
  };
  const listener = { addListener() {} };
  globalThis.setTimeout = (fn, ms, ...args) =>
    previousTimeout(fn, ms === 45_000 ? 50 : ms, ...args);
  globalThis.chrome = {
    runtime: {
      onInstalled: listener,
      onStartup: listener,
      onMessage: {
        addListener(fn) {
          receive = fn;
        },
      },
    },
    tabs: {
      async query({ url }) {
        return [
          {
            id: url.startsWith("https://leetcode") ? 2 : 1,
            url: url.replace("*", ""),
          },
        ];
      },
    },
    permissions: {
      async contains() {
        return true;
      },
      async remove() {
        throw new Error("You cannot remove required permissions.");
      },
    },
    storage: {
      local: {
        async get(key) {
          return typeof key === "string" ? { [key]: stored[key] } : stored;
        },
        async set(value) {
          Object.assign(stored, value);
        },
        async remove(keys) {
          for (const key of keys) delete stored[key];
        },
      },
    },
    alarms: {
      onAlarm: listener,
      async create() {},
      async clear() {
        alarmCleared = true;
      },
    },
    action: {
      setBadgeText() {
        return new Promise(() => {});
      },
      setBadgeBackgroundColor() {
        return new Promise(() => {});
      },
    },
    scripting: {
      async executeScript({ func, args }) {
        if (func.name === "readSolvedInLeetCodeTab")
          return [
            { result: { username: "fixture_student", total: 24, slugs } },
          ];
        if (args[1] === "profile") return [{ result: { settings: profile } }];
        if (args[1] === "recent") return new Promise(() => {});
        calls.push(args[2]);
        return [
          {
            result: {
              ok: true,
              message: "Full history imported: 24 solved questions.",
              total: 24,
              matched: 21,
              changed: 21,
            },
          },
        ];
      },
    },
  };
  let watchdog;
  try {
    await import("../../extensions/leetcode-sync/background.mjs");
    const response = new Promise((resolve) =>
      receive({ type: "connect", origin: "https://prep.test" }, {}, resolve),
    );
    const result = await Promise.race([
      response,
      new Promise((_, reject) => {
        watchdog = previousTimeout(
          () =>
            reject(new Error("Core import blocked on an optional operation")),
          1000,
        );
      }),
    ]);
    assert.equal(result.ok, true);
    assert.match(result.message, /24 solved/);
    assert.equal(stored.lastResult.error, false);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      schema: 1,
      username: "fixture_student",
      total: 24,
      slugs,
      bindingVersion: profile.binding_version,
    });
    const disconnected = await new Promise((resolve) =>
      receive({ type: "disconnect" }, {}, resolve),
    );
    assert.equal(disconnected.ok, true);
    assert.equal(stored.connection, undefined);
    assert.equal(alarmCleared, true);
    // Let the bounded supplemental operation finish its timeout before restoring globals.
    await new Promise((resolve) => previousTimeout(resolve, 75));
  } finally {
    clearTimeout(watchdog);
    globalThis.setTimeout = previousTimeout;
    if (previousChrome === undefined) delete globalThis.chrome;
    else globalThis.chrome = previousChrome;
  }
});
