import type { PoolClient } from "pg";
export type DashboardQuestion = {
  id: string;
  title: string;
  canonical_url: string;
  difficulty: string | null;
  status: string;
  updated_at: string;
  next_revision_at: string | null;
  revision_confidence: number | null;
  practice_path: string | null;
};
export function dashboardPractice(client: PoolClient): Promise<{
  recent: DashboardQuestion[];
  revisions: DashboardQuestion[];
}>;
