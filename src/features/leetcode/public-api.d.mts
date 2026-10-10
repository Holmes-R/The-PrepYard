export const SYNC_INTERVAL_MS: number;
export const PUBLIC_SUBMISSION_LIMIT: number;
export const LEETCODE_ENDPOINT: string;
export const PUBLIC_ACCEPTED_QUERY: string;
export class LeetCodeSyncError extends Error {
  status: number;
  constructor(message: string, status?: number);
}
export type AcceptedSubmission = {
  id: string;
  slug: string;
  submittedAt: string;
};
export type PublicAccepted = {
  username: string;
  submissions: AcceptedSubmission[];
};
export function normalizeUsername(input: unknown): string | null;
export function parsePublicAccepted(
  body: unknown,
  requestedUsername: string,
): PublicAccepted;
export function fetchPublicAccepted(
  username: string,
  options?: { fetcher?: typeof fetch },
): Promise<PublicAccepted>;
