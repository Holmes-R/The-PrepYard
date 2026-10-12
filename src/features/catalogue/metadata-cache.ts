import "server-only";
import { createHash } from "node:crypto";
import { createCatalogueCache } from "./cache.mjs";
import { cacheEvent } from "@/lib/performance/timing.mjs";

const metadata = createCatalogueCache({ onEvent: cacheEvent });
// Separate database targets without exposing a connection string in cache keys
// or logs. This module is replaced on deployment, clearing old catalogue code.
export function cachedMetadata<T>(key: string, loader: () => Promise<T>) {
  const database = createHash("sha256")
    .update(process.env.DATABASE_URL ?? "")
    .digest("hex");
  return metadata.read(database + ":" + key, loader);
}
