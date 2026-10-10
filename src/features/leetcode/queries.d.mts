import type { PoolClient } from "pg";
import type { AcceptedSubmission } from "./public-api.mjs";
export type SyncSettings = {
  username: string;
  binding_version: string;
  sync_started_at: Date;
  last_history_at: Date | null;
  history_total: number;
  history_matched_count: number;
  enabled: boolean;
  last_attempt_at: Date | null;
  last_synced_at: Date | null;
  last_error: string | null;
  last_matched_count: number;
};
export type SyncClaim = { username: string; binding_version: string };
export function syncSettings(client: PoolClient): Promise<SyncSettings | null>;
export function connectProfile(
  client: PoolClient,
  username: string,
): Promise<SyncSettings>;
export function disconnectProfile(client: PoolClient): Promise<void>;
export function setSyncEnabled(
  client: PoolClient,
  enabled: boolean,
): Promise<SyncSettings | null>;
export function claimSync(client: PoolClient): Promise<SyncClaim | null>;
export function recordSyncError(
  client: PoolClient,
  bindingVersion: string,
  message: string,
): Promise<void>;
export function applyAccepted(
  client: PoolClient,
  claim: SyncClaim,
  submissions: AcceptedSubmission[],
): Promise<{ cancelled: boolean; matched: number; changed: number }>;
