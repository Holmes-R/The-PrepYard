import type { Metadata } from "next";
import Link from "next/link";
import localFont from "next/font/local";
import { ClientSession } from "@/components/auth/client-session";
import "./client-loading.css";
import "./globals.css";
import "./launch-theme.css";
import "./stitch-theme.css";
import "./control-theme.css";
import "./question-polish.css";
import "./question-uniform.css";

const inter = localFont({
  src: "./fonts/Inter-variable.ttf",
  display: "swap",
  variable: "--font-inter",
  weight: "100 900",
});

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
    <html lang="en" className={inter.variable}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <ClientSession>
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
        </ClientSession>
      </body>
    </html>
  );
}
