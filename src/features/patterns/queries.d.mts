import type { PoolClient } from "pg";
export type Choice = { slug: string; name: string };
export type PatternFilters = {
  q: string;
  topic: string;
  pattern: string;
  collection: string;
  difficulty: string;
  progress: string;
  sort: string;
  page: number;
};
export type PatternQuestion = {
  id: string;
  title: string;
  canonical_url: string;
  difficulty: string | null;
  platform: string;
  frequency: number | null;
  status: string;
  bookmarked: boolean;
  revision: boolean;
  note: string;
  patterns: Choice[];
};
export type PatternRows = {
  rows: PatternQuestion[];
  total: number;
  solved: number;
  page: number;
  pages: number;
};
export type PatternOverview = {
  groups: (Choice & { position: number; total: number; solved: number })[];
  topics: Choice[];
  patterns: Choice[];
  collections: Choice[];
  total: number;
  solved: number;
};
export function patternFilters(
  params?: Record<string, string | string[] | undefined>,
): PatternFilters;
export function patternOverview(
  client: PoolClient,
  filters: PatternFilters,
): Promise<PatternOverview>;
export function patternQuestions(
  client: PoolClient,
  filters: PatternFilters,
): Promise<PatternRows>;
