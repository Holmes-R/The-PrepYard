export const MAX_HISTORY_QUESTIONS: number;
export const MAX_HISTORY_BYTES: number;
export type SolvedHistory = {
  schema: 1;
  username: string;
  bindingVersion: string;
  total: number;
  slugs: string[];
};
export function parseHistory(body: unknown): SolvedHistory;
export function readHistoryRequest(request: Request): Promise<SolvedHistory>;
