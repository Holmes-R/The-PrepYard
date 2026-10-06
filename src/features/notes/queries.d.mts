import type { PoolClient } from "pg";
export type NotePage = {
  rows: {
    id: string;
    title: string;
    canonical_url: string;
    content: string;
    updated_at: Date;
  }[];
  total: number;
  page: number;
  pages: number;
};
export function studentNotes(
  client: PoolClient,
  requestedPage?: string | number,
): Promise<NotePage>;
