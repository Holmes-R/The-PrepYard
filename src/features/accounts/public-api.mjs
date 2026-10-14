export const ACCOUNT_SYNC_INTERVAL_MS = 120_000;
export const MAX_SOLVED_QUESTIONS = 20_000;
const GFG_PROFILE =
  "https://authapi.geeksforgeeks.org/api-get/user-profile-info/";
export const GFG_SUBMISSIONS =
  "https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/";

export class AccountSyncError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.status = status;
  }
}
export function normalizeGfgUsername(input) {
  if (typeof input !== "string") return null;
  const value = input.trim();
  return /^[A-Za-z0-9_-]{1,60}$/.test(value) ? value : null;
}
const unavailable = () =>
  new AccountSyncError(
    "GeeksforGeeks syncing is temporarily unavailable. Your progress has not been changed.",
  );
export function parseGfgSnapshot(profile, submissions, username) {
  if (!normalizeGfgUsername(username))
    throw new AccountSyncError("Enter a valid GeeksforGeeks username.", 400);
  const data = profile?.data;
  if (
    !data ||
    !Number.isSafeInteger(data.total_problems_solved) ||
    data.total_problems_solved < 0 ||
    data.total_problems_solved > MAX_SOLVED_QUESTIONS
  )
    throw unavailable();
  if (data.practice_course_visibility !== true)
    throw new AccountSyncError(
      "Make your GeeksforGeeks practice profile public before connecting.",
      422,
    );
  if (
    submissions?.status !== "success" ||
    !submissions.result ||
    typeof submissions.result !== "object" ||
    Array.isArray(submissions.result)
  )
    throw unavailable();
  const slugs = new Set();
  for (const [difficulty, group] of Object.entries(submissions.result)) {
    if (
      !["School", "Basic", "Easy", "Medium", "Hard"].includes(difficulty) ||
      !group ||
      typeof group !== "object" ||
      Array.isArray(group)
    )
      throw unavailable();
    for (const row of Object.values(group)) {
      if (
        typeof row?.slug !== "string" ||
        !/^[a-z0-9][a-z0-9-]{0,199}$/.test(row.slug) ||
        slugs.has(row.slug)
      )
        throw unavailable();
      slugs.add(row.slug);
      if (slugs.size > MAX_SOLVED_QUESTIONS) throw unavailable();
    }
  }
  // An incomplete list must never establish a baseline or turn old history into
  // new completions. The public profile and practice endpoint must agree.
  if (slugs.size !== data.total_problems_solved) throw unavailable();
  return { username, slugs: [...slugs].sort() };
}
export async function fetchGfgSnapshot(
  username,
  { fetcher = globalThis.fetch } = {},
) {
  if (!normalizeGfgUsername(username))
    throw new AccountSyncError("Enter a valid GeeksforGeeks username.", 400);
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Origin: "https://www.geeksforgeeks.org",
    Referer: "https://www.geeksforgeeks.org/",
    "User-Agent": "ThePrepYard/0.1",
  };
  const signal = AbortSignal.timeout(15_000);
  async function read(url, options, isProfile = false) {
    const response = await fetcher(url, {
      ...options,
      headers,
      redirect: "error",
      cache: "no-store",
      signal,
    });
    if (isProfile && [400, 404].includes(response.status))
      throw new AccountSyncError(
        "No public GeeksforGeeks profile was found. Check your username.",
        422,
      );
    if (
      !response.ok ||
      Number(response.headers.get("content-length")) > 2_000_000
    )
      throw unavailable();
    // Bound streamed data too; some endpoints omit Content-Length.
    const reader = response.body?.getReader();
    if (!reader) throw unavailable();
    const chunks = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 2_000_000) {
          await reader.cancel();
          throw unavailable();
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  try {
    const url = new URL(GFG_PROFILE);
    url.search = new URLSearchParams({
      handle: username,
      article_count: "false",
      redirect: "true",
    }).toString();
    const profile = await read(url.href, { method: "GET" }, true);
    const submissions = await read(GFG_SUBMISSIONS, {
      method: "POST",
      body: JSON.stringify({
        handle: username,
        requestType: "",
        year: "",
        month: "",
      }),
    });
    return parseGfgSnapshot(profile, submissions, username);
  } catch (error) {
    if (error instanceof AccountSyncError) throw error;
    throw unavailable();
  }
}
