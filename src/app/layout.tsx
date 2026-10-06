import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/navigation/site-header";
import "./globals.css";
import "./launch-theme.css";
import "./stitch-theme.css";
import { currentUser } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: {
    default: "The PrepYard | Prepare together",
    template: "%s | The PrepYard",
  },
  description:
    "A free home for company-wise coding preparation, patterns, and practice across platforms.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <SiteHeader user={user} />
        <main id="main-content" className="prep-main">
          {children}
        </main>
        <footer className="prep-footer">
          <nav
            aria-label="Footer"
            className="mb-3 flex flex-wrap justify-center gap-x-6 gap-y-2"
          >
            <Link href="/">Home</Link>
            <Link href="/companies">Companies</Link>
            <Link href="/patterns">Patterns</Link>
            <Link href="/about">About</Link>
          </nav>
          <p>The PrepYard · Built for students. Free with an account.</p>
        </footer>
      </body>
    </html>
  );
}
