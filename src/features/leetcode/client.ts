"use client";

import { refreshClientData } from "@/lib/client/use-client-resource";
export const SYNC_SETTINGS_URL = "/api/integrations/leetcode";
export const externalProgressEvent = "prepyard:external-progress";
export const syncChannel = "prepyard:leetcode-sync";
export type ClientSyncSettings = {
  username: string;
  binding_version: string;
  sync_started_at: string;
  last_history_at: string | null;
  history_total: number;
  history_matched_count: number;
  enabled: boolean;
  last_attempt_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  last_matched_count: number;
};
export type SyncResource = { settings: ClientSyncSettings | null };
export type SyncResult = {
  ok: boolean;
  skipped?: boolean;
  changed?: number;
  matched?: number;
  message?: string;
  error?: string;
};

export function refreshExternalProgress() {
  refreshClientData();
  window.dispatchEvent(new Event(externalProgressEvent));
}

export function announceSyncedProgress(userId: string) {
  refreshExternalProgress();
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(syncChannel);
    channel.postMessage({ type: "accepted", userId });
    channel.close();
  }
}

export async function postLeetCode(
  action: string,
  username?: string,
  signal?: AbortSignal,
): Promise<SyncResult> {
  const response = await fetch(SYNC_SETTINGS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    signal,
    body: JSON.stringify({ action, username }),
  });
  if (response.status === 401) {
    window.location.replace(
      "/login?next=" +
        encodeURIComponent(window.location.pathname + window.location.search),
    );
    throw new Error("Log in again to continue.");
  }
  const result = (await response.json()) as SyncResult;
  if (!response.ok || !result.ok)
    throw new Error(result.error || "Could not sync. Please try again.");
  return result;
}
