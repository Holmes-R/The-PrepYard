"use client";

import { useEffect } from "react";
import { useClientResource } from "@/lib/client/use-client-resource";
import { SYNC_INTERVAL_MS } from "@/features/leetcode/public-api.mjs";
import {
  SYNC_SETTINGS_URL,
  syncChannel,
  postLeetCode,
  announceSyncedProgress,
  refreshExternalProgress,
  type SyncResource,
} from "@/features/leetcode/client";

export function LeetCodeSyncCoordinator({ userId }: { userId: string }) {
  const { data, retry } = useClientResource<SyncResource>(SYNC_SETTINGS_URL, {
    changes: false,
  });
  const enabled = data?.settings?.enabled;
  const username = data?.settings?.username;

  useEffect(() => {
    const imported = () => {
      announceSyncedProgress(userId);
      retry();
    };
    window.addEventListener("prepyard:history-imported", imported);
    return () =>
      window.removeEventListener("prepyard:history-imported", imported);
  }, [userId, retry]);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(syncChannel);
    channel.onmessage = (event) => {
      if (event.data?.type === "accepted" && event.data.userId === userId) {
        refreshExternalProgress();
        retry();
      }
    };
    return () => channel.close();
  }, [userId, retry]);

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
        const result = await postLeetCode("sync", undefined, controller.signal);
        if (!active) return;
        if (result.changed) announceSyncedProgress(userId);
        if (!result.skipped) retry();
      } catch {
        // A failed sync leaves normal practice usable; the settings page shows
        // its stored error. Do not repeatedly retry a blocked upstream service.
        if (active) retry();
      } finally {
        busy = false;
        if (active) {
          nextAllowed = Date.now() + SYNC_INTERVAL_MS;
          timer = window.setTimeout(() => void run(), SYNC_INTERVAL_MS);
        }
      }
    };
    void run();
    const onVisible = () => {
      void run();
    };
    window.addEventListener("online", onVisible);
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, username, userId, retry]);
  return null;
}
