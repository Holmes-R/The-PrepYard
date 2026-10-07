import "server-only";
import { withStudentDatabase } from "@/lib/database/server";
import {
  companiesSql,
  companyLogos,
  companySheet,
  questionNote,
  type Filters,
} from "./queries.mjs";
export async function listCompanies() {
  return withStudentDatabase(
    async (client) =>
      (
        await client.query<{
          slug: string;
          name: string;
          has_logo: boolean;
          question_count: number;
          solved_count: number;
          easy_count: number;
          medium_count: number;
          hard_count: number;
        }>(companiesSql)
      ).rows,
  );
}
export async function getCompanySheet(slug: string, filters: Filters) {
  return withStudentDatabase((client) => companySheet(client, slug, filters));
}
export async function getQuestionNote(questionId: string) {
  return withStudentDatabase((client) => questionNote(client, questionId));
}
export async function getCompanyLogos(slugs: string[]) {
  return withStudentDatabase((client) => companyLogos(client, slugs));
}
export async function getCompanyLogo(slug: string) {
  return withStudentDatabase(async (client) => {
    const { rows } = await client.query<{
      content_type: string;
      image: Buffer;
      sha256: string;
    }>(
      `select l.content_type,l.image,l.sha256
       from public.company_logos l
       join public.companies c on c.id=l.company_id
       where c.slug=$1`,
      [slug],
    );
    const row = rows[0];
    return row ? { ...row, image: new Uint8Array(row.image) } : null;
  });
}
