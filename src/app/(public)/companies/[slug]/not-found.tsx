import Link from "next/link";
export default function NotFound() {
  return (
    <div className="company-sheet-theme">
      <nav aria-label="Breadcrumb">
        <ol className="sheet-crumbs">
          <li>
            <Link href="/companies">All companies</Link>
          </li>
          <li aria-current="page">Company not found</li>
        </ol>
      </nav>
      <header className="company-page-heading">
        <p className="sheet-eyebrow">Company-wise practice</p>
        <h1>No such company</h1>
        <p>
          This company is not in the catalogue, or its sheet has no published
          questions yet.
        </p>
      </header>
      <p>
        <Link href="/companies" className="sheet-apply">
          Back to all companies
        </Link>
      </p>
    </div>
  );
}
