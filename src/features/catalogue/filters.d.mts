import type { Filters } from "./queries.mjs";
export type { Filters, Sheet, DifficultyCounts } from "./queries.mjs";
export const windowLabels: Record<string, string>;
export const progressLabels: Record<string, string>;
export function filtersFrom(
  params?: Record<string, string | string[] | undefined>,
): Filters;
export function filtersToParams(
  filters: Filters,
  openSlug?: string,
): URLSearchParams;
