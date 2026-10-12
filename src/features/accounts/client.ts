"use client";
import type { SyncResult } from "@/features/leetcode/client";
export const GFG_SETTINGS_URL = "/api/integrations/gfg";
export type ClientAccountSettings = {
  username: string;
  enabled: boolean;
  binding_version: string;
  sync_started_at: string;
  last_attempt_at: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  last_matched_count: number;
};
export type AccountResource = { settings: ClientAccountSettings | null };
export async function postGfg(
  action: string,
  username?: string,
  signal?: AbortSignal,
): Promise<SyncResult> {
  const response = await fetch(GFG_SETTINGS_URL, {
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
