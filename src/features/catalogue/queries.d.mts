import type { PoolClient } from "pg";
export const windowLabels: Record<string, string>;
export type Filters = {
  q: string;
  difficulty: string;
  window: string;
  sort: string;
  page: number;
};
export function filtersFrom(
  params?: Record<string, string | string[] | undefined>,
): Filters;
export const companiesSql: string;
export type CompanyTag = {
  slug: string;
  name: string;
  frequency: number | null;
};
export type Sheet = {
  company: { id: string; slug: string; name: string };
  available: string[];
  rows: {
    id: string;
    title: string;
    canonical_url: string;
    difficulty: string | null;
    platform: string;
    frequency: number | null;
    companies: CompanyTag[];
    status: string;
    bookmarked: boolean;
    revision: boolean;
    note: string;
  }[];
  solved: number;
  total: number;
  page: number;
  pages: number;
};
export function companySheet(
  client: PoolClient,
  slug: string,
  filters: Filters,
): Promise<Sheet | null>;
