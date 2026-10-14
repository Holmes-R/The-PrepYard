import type { PoolClient } from "pg";
import type { SolvedSnapshot } from "./public-api.mjs";
export type AccountSettings = {
  username: string;
  enabled: boolean;
  binding_version: string;
  sync_started_at: Date;
  last_attempt_at: Date | null;
  last_synced_at: Date | null;
  last_error: string | null;
  last_matched_count: number;
};
export type AccountClaim = { username: string; binding_version: string };
export function accountSettings(
  client: PoolClient,
): Promise<AccountSettings | null>;
export function connectAccount(
  client: PoolClient,
  snapshot: SolvedSnapshot,
): Promise<AccountSettings>;
export function disconnectAccount(client: PoolClient): Promise<void>;
export function setAccountEnabled(
  client: PoolClient,
  enabled: boolean,
): Promise<AccountSettings | null>;
export function claimAccountSync(
  client: PoolClient,
): Promise<AccountClaim | null>;
export function recordAccountError(
  client: PoolClient,
  bindingVersion: string,
  message: string,
): Promise<void>;
export function applySolvedSnapshot(
  client: PoolClient,
  claim: AccountClaim,
  snapshot: SolvedSnapshot,
): Promise<{ cancelled: boolean; matched: number; changed: number }>;
