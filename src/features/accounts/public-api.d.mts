export const ACCOUNT_SYNC_INTERVAL_MS: number;
export const MAX_SOLVED_QUESTIONS: number;
export const GFG_SUBMISSIONS: string;
export class AccountSyncError extends Error {
  status: number;
  constructor(message: string, status?: number);
}
export type SolvedSnapshot = { username: string; slugs: string[] };
export function normalizeGfgUsername(input: unknown): string | null;
export function parseGfgSnapshot(
  profile: unknown,
  submissions: unknown,
  username: string,
): SolvedSnapshot;
export function fetchGfgSnapshot(
  username: string,
  options?: { fetcher?: typeof fetch },
): Promise<SolvedSnapshot>;
