import type { PoolClient } from "pg";
export function measure<T>(
  name: "auth" | "pool",
  operation: () => Promise<T>,
): Promise<T>;
export function cacheEvent(event: "hit" | "miss" | "wait"): void;
export function instrumentDatabaseClient(client: PoolClient): PoolClient;
export function withServerTiming(
  operation: () => Promise<Response>,
  label?: string,
): Promise<Response>;
