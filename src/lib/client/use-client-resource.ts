"use client";

import { useCallback, useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";

const changedEvent = "prepyard:data-changed";
export function refreshClientData() {
  window.dispatchEvent(new Event(changedEvent));
}

export type JsonData<T> = T extends Date
  ? string
  : T extends object
    ? { [K in keyof T]: JsonData<T[K]> }
    : T;

class ResourceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function fetchResource<T>([, url]: readonly [
  string,
  string,
]): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ResourceError(
      "Could not load this content. Check your connection and try again.",
      0,
    );
  }
  if (!response.ok)
    throw new ResourceError(
      response.status === 404
        ? "We could not find this page."
        : "Could not load this content. Please try again.",
      response.status,
    );
  return response.json() as Promise<T>;
}

export function useClientResource<T>(
  url: string,
  { scope = "", changes = true }: { scope?: string; changes?: boolean } = {},
) {
  const { mutate: mutateCache } = useSWRConfig();
  const { data, error, isLoading, isValidating, mutate } = useSWR<
    T,
    ResourceError
  >([scope, url], fetchResource<T>, {
    dedupingInterval: 2000,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
    keepPreviousData: false,
  });
  const unauthorized = error?.status === 401;
  const retry = useCallback(() => {
    void mutate();
  }, [mutate]);

  useEffect(() => {
    if (!unauthorized) return;
    // Clear this authentication boundary's private cache before leaving it.
    void mutateCache(() => true, undefined, { revalidate: false });
    window.location.replace(
      "/login?next=" +
        encodeURIComponent(window.location.pathname + window.location.search),
    );
  }, [unauthorized, mutateCache]);

  useEffect(() => {
    if (!changes) return;
    window.addEventListener(changedEvent, retry);
    return () => window.removeEventListener(changedEvent, retry);
  }, [changes, retry]);

  return {
    data: unauthorized ? null : (data ?? null),
    error: error?.message ?? "",
    status: error?.status ?? (data === undefined ? 0 : 200),
    loading: isLoading || isValidating,
    retry,
  };
}
