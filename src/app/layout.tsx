import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/navigation/site-header";
import "./globals.css";
import "./launch-theme.css";

export const metadata: Metadata = {
  title: {
    default: "The PrepYard | Prepare together",
    template: "%s | The PrepYard",
  },
  description:
    "A free home for company-wise coding preparation, patterns, and practice across platforms.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <SiteHeader />
        <main
          id="main-content"
          className="mx-auto min-h-[75vh] max-w-6xl px-5 py-12 md:px-8"
        >
          {children}
        </main>
        <footer className="border-t px-5 py-7 text-center text-sm text-muted-foreground">
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
