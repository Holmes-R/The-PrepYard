import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanySheet } from "@/features/catalogue/server";
import { filtersFrom } from "@/features/catalogue/queries.mjs";
import { CompanySection } from "@/components/questions/company-sheet";
export const metadata = { title: "Company questions" };
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 200) notFound();
  const filters = filtersFrom(await searchParams);
  const sheet = await getCompanySheet(slug, filters);
  if (!sheet) notFound();
  return (
    <div className="company-sheet-theme">
      <Link href="/companies" className="sheet-back">
        ← All companies
      </Link>
      <header className="company-page-heading">
        <p className="sheet-eyebrow">Company-wise practice</p>
        <h1>{sheet.company.name}</h1>
        <p>Practice the questions. Track every step.</p>
      </header>
      <CompanySection
        company={{
          ...sheet.company,
          question_count: sheet.total,
          solved_count: sheet.solved,
        }}
        initial={sheet}
        initialFilters={filters}
      />
      <p className="sheet-footnote">
        Company tags are sorted by frequency within the selected window.
        Checkmarks, bookmarks, revision reminders, and notes are private to your
        account.
      </p>
    </div>
  );
}
