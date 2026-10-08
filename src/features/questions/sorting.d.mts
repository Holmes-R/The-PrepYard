export type SortRule = { key: string; direction: "asc" | "desc" };
export function parseOrder(raw: unknown, allowed?: string[]): SortRule[];
export function cleanOrder(raw: unknown, allowed?: string[]): string;
export function effectiveOrder(order: string | undefined, sort: string): string;
export function toggleOrder(raw: string, key: string): string;
export function orderSql(
  raw: unknown,
  expressions: Record<string, string[]>,
): string;
export function revisionExpressions(alias?: string): string[];
export const difficultyExpression: string;
