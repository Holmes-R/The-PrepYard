export type RoadmapPattern = {
  slug: string;
  name: string;
  position: number;
  aliases: string[];
  tags: string[];
  questions: {
    position: number;
    referenceTitle: string;
    title: string;
    url: string;
    platform: string;
    externalId?: string;
    category: string;
  }[];
};
export const roadmapPatterns: RoadmapPattern[];
export const roadmapChoices: { slug: string; name: string; position: number }[];
export function roadmapPattern(slug: string): RoadmapPattern | null;
export function canonicalPatternSlug(slug: string): string;
export function roadmapPredicate(
  slug: string,
  add: (value: unknown) => string,
): string;
export function roadmapRecommendedOrder(
  slug: string,
  add: (value: unknown) => string,
): string;
export function decorateRoadmapQuestions<
  T extends {
    canonical_url: string;
    topics?: { slug: string }[];
    patterns?: { slug: string; name: string }[];
  },
>(rows: T[]): T[];
