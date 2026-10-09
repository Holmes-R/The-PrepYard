"use client";

import Link from "next/link";
import {
  CompanyDirectory,
  CompanySection,
  type CompanyItem,
} from "@/components/questions/company-sheet";
import { PatternSheet } from "@/components/sheets/pattern-sheet";
import { PatternDetail } from "@/components/sheets/pattern-detail";
import { ResourceState } from "@/components/feedback/resource-state";
import { useClientResource } from "@/lib/client/use-client-resource";
import {
  filtersToParams,
  type Filters,
  type Sheet,
} from "@/features/catalogue/queries.mjs";
import type {
  Choice,
  PatternFilters,
  PatternOverview,
  PatternRows,
} from "@/features/patterns/queries.mjs";

function patternQuery(filters: PatternFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value) params.set(key, String(value));
  return params.toString();
}

export function ClientCompanies({
  open,
  find,
  filters,
}: {
  open: string | null;
  find: string;
  filters: Filters;
}) {
  const resource = useClientResource<CompanyItem[]>("/api/companies");
  return resource.data ? (
    <CompanyDirectory
      companies={resource.data}
      initialOpen={open}
      initialFind={find}
      initialFilters={filters}
    />
  ) : (
    <ResourceState title="Company questions" {...resource} />
  );
}

export function ClientCompany({
  slug,
  filters,
}: {
  slug: string;
  filters: Filters;
}) {
  // CompanySection refreshes its own rows after saves. The directory separately
  // listens for mutations to refresh its totals without fetching this sheet twice.
  const resource = useClientResource<Sheet>(
    "/api/companies/" + slug + "?" + filtersToParams(filters),
    { changes: false },
  );
  const sheet = resource.data;
  if (!sheet) return <ResourceState title="Company questions" {...resource} />;
  return (
    <div className="company-sheet-theme">
      <nav aria-label="Breadcrumb">
        <ol className="sheet-crumbs">
          <li>
            <Link href="/companies">All companies</Link>
          </li>
          <li aria-current="page">{sheet.company.name}</li>
        </ol>
      </nav>
      <header className="company-page-heading">
        <p className="sheet-eyebrow">Company-wise practice</p>
        <h1>{sheet.company.name} Interview Questions</h1>
        <p>Practice the questions. Track every step.</p>
      </header>
      <CompanySection
        key={JSON.stringify(filters)}
        company={{
          ...sheet.company,
          question_count: sheet.total,
          solved_count: sheet.solved,
          easy_count: sheet.easy_count,
          medium_count: sheet.medium_count,
          hard_count: sheet.hard_count,
        }}
        initial={sheet}
        initialFilters={filters}
        syncUrl
      />
      <p className="sheet-footnote">
        Company tags are sorted by frequency within the selected window.
        Completion, revision history, and notes are private to your account.
      </p>
    </div>
  );
}

export function ClientPatterns({ filters }: { filters: PatternFilters }) {
  const resource = useClientResource<PatternOverview>(
    "/api/patterns/overview?" + patternQuery(filters),
  );
  return resource.data ? (
    <PatternSheet
      key={JSON.stringify(filters)}
      overview={resource.data}
      filters={filters}
    />
  ) : (
    <ResourceState title="DSA Practice Hub" {...resource} />
  );
}

export function ClientPattern({
  slug,
  filters,
}: {
  slug: string;
  filters: PatternFilters;
}) {
  const resource = useClientResource<{
    pattern: Choice;
    rows: PatternRows;
    topics: (Choice & { total: number })[];
  }>("/api/patterns/" + slug + "?" + patternQuery(filters));
  return resource.data ? (
    <PatternDetail
      key={JSON.stringify(filters)}
      {...resource.data}
      filters={filters}
    />
  ) : (
    <ResourceState title="Pattern practice" {...resource} />
  );
}
