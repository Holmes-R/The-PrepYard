"use client";
import { useEffect } from "react";
import { LeetCodeSyncCoordinator } from "./leetcode-sync-coordinator";
import { useClientResource } from "@/lib/client/use-client-resource";
import { ACCOUNT_SYNC_INTERVAL_MS } from "@/features/accounts/public-api.mjs";
import {
  GFG_SETTINGS_URL,
  postGfg,
  type AccountResource,
} from "@/features/accounts/client";
import { announceSyncedProgress } from "@/features/leetcode/client";
export function AccountSyncCoordinator({ userId }: { userId: string }) {
  return (
    <>
      <LeetCodeSyncCoordinator userId={userId} />
      <GfgSyncCoordinator userId={userId} />
    </>
  );
}
function GfgSyncCoordinator({ userId }: { userId: string }) {
  const { data, retry } = useClientResource<AccountResource>(GFG_SETTINGS_URL, {
    changes: false,
  });
  const enabled = data?.settings?.enabled,
    username = data?.settings?.username;
  useEffect(() => {
    if (!enabled || !username) return;
    let active = true,
      busy = false,
      nextAllowed = 0;
    let timer: number | undefined;
    const controller = new AbortController();
    const run = async () => {
      if (
        !active ||
        busy ||
        Date.now() < nextAllowed ||
        document.visibilityState !== "visible" ||
        !navigator.onLine
      )
        return;
      window.clearTimeout(timer);
      busy = true;
      try {
        const result = await postGfg("sync", undefined, controller.signal);
        if (!active) return;
        if (result.changed) announceSyncedProgress(userId);
        if (!result.skipped) retry();
      } catch {
        if (active) retry();
      } finally {
        busy = false;
        if (active) {
          nextAllowed = Date.now() + ACCOUNT_SYNC_INTERVAL_MS;
          timer = window.setTimeout(() => void run(), ACCOUNT_SYNC_INTERVAL_MS);
        }
      }
    };
    void run();
    const wake = () => {
      void run();
    };
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [enabled, username, userId, retry]);
  return null;
}
