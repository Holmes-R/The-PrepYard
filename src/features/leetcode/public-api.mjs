export const SYNC_INTERVAL_MS = 120_000;
export const PUBLIC_SUBMISSION_LIMIT = 20;
export const LEETCODE_ENDPOINT = "https://leetcode.com/graphql/";
export const PUBLIC_ACCEPTED_QUERY = `query PrepYardPublicAccepted($username: String!, $limit: Int!) {
  matchedUser(username: $username) { username }
  recentAcSubmissionList(username: $username, limit: $limit) {
    id titleSlug timestamp
  }
}`;

export class LeetCodeSyncError extends Error {
  constructor(message, status = 503) {
    super(message);
    this.status = status;
  }
}

export function normalizeUsername(input) {
  if (typeof input !== "string") return null;
  const username = input.trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(username) ? username : null;
}

export function parsePublicAccepted(body, requestedUsername) {
  const unavailable = () =>
    new LeetCodeSyncError(
      "LeetCode syncing is temporarily unavailable. Your progress has not been changed.",
    );
  if (
    !body ||
    typeof body !== "object" ||
    (body.errors !== undefined &&
      (!Array.isArray(body.errors) || body.errors.length)) ||
    !body.data
  )
    throw unavailable();
  if (body.data.matchedUser === null)
    throw new LeetCodeSyncError(
      "No public LeetCode profile was found for this username. Check your username or profile visibility.",
      422,
    );
  const username = normalizeUsername(body.data.matchedUser?.username);
  const list = body.data.recentAcSubmissionList;
  if (
    !username ||
    username.toLowerCase() !== requestedUsername.toLowerCase() ||
    !Array.isArray(list) ||
    list.length > PUBLIC_SUBMISSION_LIMIT
  )
    throw unavailable();
  const unique = new Map();
  for (const row of list) {
    const timestamp = Number(row?.timestamp);
    if (
      !row ||
      !["string", "number"].includes(typeof row.timestamp) ||
      !/^[0-9]{1,30}$/.test(String(row.id)) ||
      typeof row.titleSlug !== "string" ||
      row.titleSlug.length > 200 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.titleSlug) ||
      !Number.isSafeInteger(timestamp) ||
      timestamp <= 0 ||
      timestamp > Math.floor(Date.now() / 1000) + 300
    )
      throw unavailable();
    if (row.statusDisplay !== undefined && row.statusDisplay !== "Accepted")
      throw unavailable();
    const submission = {
      id: String(row.id),
      slug: row.titleSlug,
      submittedAt: new Date(timestamp * 1000).toISOString(),
    };
    const prior = unique.get(submission.id);
    if (
      prior &&
      (prior.slug !== submission.slug ||
        prior.submittedAt !== submission.submittedAt)
    )
      throw unavailable();
    unique.set(submission.id, submission);
  }
  return { username, submissions: [...unique.values()] };
}

export async function fetchPublicAccepted(
  username,
  { fetcher = globalThis.fetch } = {},
) {
  if (!normalizeUsername(username))
    throw new LeetCodeSyncError("Enter a valid LeetCode username.", 400);
  try {
    const response = await fetcher(LEETCODE_ENDPOINT, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "ThePrepYard/0.1",
      },
      body: JSON.stringify({
        query: PUBLIC_ACCEPTED_QUERY,
        variables: { username, limit: PUBLIC_SUBMISSION_LIMIT },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error("Upstream unavailable");
    return parsePublicAccepted(await response.json(), username);
  } catch (error) {
    if (error instanceof LeetCodeSyncError) throw error;
    throw new LeetCodeSyncError(
      "LeetCode syncing is temporarily unavailable. Your progress has not been changed.",
    );
  }
}
