"use client";

import { useCallback, useEffect, useReducer, useState } from "react";

const changedEvent = "prepyard:data-changed";
export function refreshClientData() {
  window.dispatchEvent(new Event(changedEvent));
}

export type JsonData<T> = T extends Date
  ? string
  : T extends object
    ? { [K in keyof T]: JsonData<T[K]> }
    : T;

export function useClientResource<T>(
  url: string,
  { scope = "", changes = true }: { scope?: string; changes?: boolean } = {},
) {
  const [revision, reload] = useReducer((value: number) => value + 1, 0);
  const key = scope + "|" + url;
  const [snapshot, setSnapshot] = useState<{
    key: string;
    revision: number;
    data: T | null;
    error: string;
    status: number;
  }>({ key: "", revision: -1, data: null, error: "", status: 0 });
  const retry = useCallback(() => reload(), []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!active) return;
        if (response.status === 401) {
          window.location.replace(
            "/login?next=" +
              encodeURIComponent(
                window.location.pathname + window.location.search,
              ),
          );
          return;
        }
        if (!response.ok) {
          setSnapshot({
            key,
            revision,
            data: null,
            error:
              response.status === 404
                ? "We could not find this page."
                : "Could not load this content. Please try again.",
            status: response.status,
          });
          return;
        }
        const data = (await response.json()) as T;
        if (active)
          setSnapshot({ key, revision, data, error: "", status: 200 });
      } catch {
        if (active)
          setSnapshot({
            key,
            revision,
            data: null,
            error:
              "Could not load this content. Check your connection and try again.",
            status: 0,
          });
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [url, key, revision]);

  useEffect(() => {
    if (!changes) return;
    window.addEventListener(changedEvent, retry);
    return () => window.removeEventListener(changedEvent, retry);
  }, [changes, retry]);

  const matching = snapshot.key === key;
  const loading = !matching || snapshot.revision !== revision;
  return {
    data: matching ? snapshot.data : null,
    error: loading ? "" : snapshot.error,
    status: matching ? snapshot.status : 0,
    loading,
    retry,
  };
}
