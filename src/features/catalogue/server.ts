import "server-only";
import { withStudentDatabase } from "@/lib/database/server";
import { companiesSql, companySheet, type Filters } from "./queries.mjs";
export async function listCompanies() {
  return withStudentDatabase(
    async (client) =>
      (
        await client.query<{
          slug: string;
          name: string;
          question_count: number;
          solved_count: number;
        }>(companiesSql)
      ).rows,
  );
}
export async function getCompanySheet(slug: string, filters: Filters) {
  return withStudentDatabase((client) => companySheet(client, slug, filters));
}
