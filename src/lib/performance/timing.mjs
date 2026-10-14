import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";

const requests = new AsyncLocalStorage();
const rounded = (value) => Math.round(value * 100) / 100;

export async function measure(name, operation) {
  const stats = requests.getStore();
  if (!stats) return operation();
  const started = performance.now();
  try {
    return await operation();
  } finally {
    stats[name] = (stats[name] ?? 0) + performance.now() - started;
  }
}

export function cacheEvent(event) {
  const stats = requests.getStore();
  if (stats) stats.cache[event]++;
}

// A per-checkout proxy avoids changing a pooled client's methods or retaining
// another request's timing context. Neither SQL nor parameter values are logged.
export function instrumentDatabaseClient(client) {
  return new Proxy(client, {
    get(target, property) {
      if (property === "query")
        return (...args) => {
          const stats = requests.getStore();
          if (!stats) return target.query(...args);
          stats.queries++;
          const started = performance.now();
          let finished = false;
          const finish = () => {
            if (!finished) stats.db += performance.now() - started;
            finished = true;
          };
          const last = args.length - 1;
          if (typeof args[last] === "function") {
            const callback = args[last];
            args[last] = (...values) => {
              finish();
              callback(...values);
            };
          }
          try {
            const result = target.query(...args);
            if (result && typeof result.then === "function")
              return result.finally(finish);
            return result;
          } catch (error) {
            finish();
            throw error;
          }
        };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export function withServerTiming(operation, label = "private-api") {
  const stats = {
    db: 0,
    pool: 0,
    auth: 0,
    queries: 0,
    cache: { hit: 0, miss: 0, wait: 0 },
  };
  return requests.run(stats, async () => {
    const started = performance.now();
    const response = await operation();
    const app = rounded(performance.now() - started);
    const headers = new Headers(response.headers);
    headers.set(
      "Server-Timing",
      [
        `app;dur=${app}`,
        `auth;dur=${rounded(stats.auth)}`,
        `pool;dur=${rounded(stats.pool)}`,
        `db;dur=${rounded(stats.db)};desc="${stats.queries} queries"`,
        `catalogue_cache;desc="${stats.cache.hit} hits, ${stats.cache.miss} misses, ${stats.cache.wait} waits"`,
      ].join(", "),
    );
    if (process.env.PREPYARD_PERFORMANCE_LOG === "1") {
      // Labels are fixed by callers, never request URLs or user input.
      console.info(
        JSON.stringify({
          event: "prepyard.performance",
          label,
          status: response.status,
          appMs: app,
          authMs: rounded(stats.auth),
          poolMs: rounded(stats.pool),
          dbMs: rounded(stats.db),
          queries: stats.queries,
          cache: stats.cache,
        }),
      );
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });
}
