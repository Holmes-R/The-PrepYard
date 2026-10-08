import { roadmapPattern } from "./roadmap.mjs";
import "server-only";
import { withStudentDatabase } from "@/lib/database/server";
import {
  patternOverview,
  patternQuestions,
  type PatternFilters,
} from "./queries.mjs";
export const getPatternOverview = (filters: PatternFilters) =>
  withStudentDatabase((client) => patternOverview(client, filters));
export const getPatternQuestions = (filters: PatternFilters) =>
  withStudentDatabase((client) => patternQuestions(client, filters));

export const getPatternPractice = (slug: string, filters: PatternFilters) =>
  withStudentDatabase(async (client) => {
    const pattern =
      roadmapPattern(slug) ??
      (
        await client.query<{ slug: string; name: string }>(
          "select p.slug,p.name from public.patterns p where p.slug=$1 and exists(select 1 from public.question_patterns qp join public.questions q on q.id=qp.question_id join public.question_dsa_topics qt on qt.question_id=q.id where qp.pattern_id=p.id and qp.reviewed and q.is_listed)",
          [slug],
        )
      ).rows[0];
    if (!pattern) return null;
    return {
      pattern: { slug: pattern.slug, name: pattern.name },
      rows: await patternQuestions(client, { ...filters, pattern: slug }),
      topics: (
        await patternOverview(client, {
          ...filters,
          pattern: slug,
          topic: "",
          q: "",
          difficulty: "",
          progress: "",
        })
      ).groups,
    };
  });
