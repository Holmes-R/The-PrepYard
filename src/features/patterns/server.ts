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
