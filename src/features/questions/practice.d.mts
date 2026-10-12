export type Alternative = {
  source_slug: string;
  title: string;
  url: string;
  platform: string;
  difficulty: string;
  match: string;
  free_submission: boolean;
  reviewed_at: string;
  review_notes: string;
};
export function validateAlternatives(entries: Alternative[]): Alternative[];
export const reviewedAlternatives: Alternative[];
export const practiceQuestionsSql: string;
export function practiceQuestion<T extends { canonical_url: string }>(
  question: T,
): T | null;
export function practiceNote<T extends { canonical_url: string }>(note: T): T;
