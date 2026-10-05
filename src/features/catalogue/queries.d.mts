import type { PoolClient } from "pg";
export const windowLabels: Record<string, string>;
export const progressLabels: Record<string, string>;
export type Filters = {
  q: string;
  difficulty: string;
  window: string;
  sort: string;
  topics: string[];
  progress: string;
  minFrequency: number | null;
  minAcceptance: number | null;
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
export type TopicTag = { slug: string; name: string };
export type CompanyTopic = TopicTag & { uses: number };
export type Sheet = {
  company: { id: string; slug: string; name: string };
  available: string[];
  topics: CompanyTopic[];
  rows: {
    id: string;
    title: string;
    canonical_url: string;
    difficulty: string | null;
    platform: string;
    frequency: number | null;
    acceptance: number | null;
    topics: TopicTag[];
    patterns: TopicTag[];
    companies: CompanyTag[];
    status: string;
    bookmarked: boolean;
    revision: boolean;
    has_note: boolean;
  }[];
  solved: number;
  total: number;
  page: number;
  pages: number;
};
export type CompanyLogo = {
  content_type: string;
  image: Uint8Array;
  sha256: string;
};
export type CompanyLogoEntry = {
  content_type: string;
  data: string;
  sha256: string;
};
export function companyLogos(
  client: PoolClient,
  slugs: string[],
): Promise<Record<string, CompanyLogoEntry>>;
export function companyTopics(
  client: PoolClient,
  companyId: string,
): Promise<CompanyTopic[]>;
export function companySheet(
  client: PoolClient,
  slug: string,
  filters: Filters,
): Promise<Sheet | null>;
export function filtersToParams(
  filters: Filters,
  openSlug?: string,
): URLSearchParams;
export function questionNote(
  client: PoolClient,
  questionId: string,
): Promise<string>;
