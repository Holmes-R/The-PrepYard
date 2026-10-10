import type { PoolClient } from "pg";
import type { SolvedHistory } from "./history.mjs";
export function applyHistory(
  client: PoolClient,
  history: SolvedHistory,
): Promise<{
  ok: boolean;
  skipped: boolean;
  changed: number;
  total?: number;
  matched?: number;
  message: string;
}>;
