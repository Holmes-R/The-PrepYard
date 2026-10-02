"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sprout } from "lucide-react";
import { sections } from "@/lib/site";
import { signOut } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-5 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold tracking-tight"
        >
          <Sprout aria-hidden="true" className="text-primary" /> The PrepYard
        </Link>
        {!["/login", "/signup"].includes(pathname) && (
          <nav
            aria-label="Main navigation"
            className="flex flex-wrap gap-x-5 gap-y-3 text-sm"
          >
            {sections.map(({ href, title }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={cn(
                  "hover:text-primary",
                  pathname === href
                    ? "font-bold text-primary"
                    : "text-muted-foreground",
                )}
              >
                {title}
              </Link>
            ))}
            <form action={signOut}>
              <button className="font-semibold hover:text-primary">
                Sign out
              </button>
            </form>
          </nav>
        )}
      </div>
    </header>
  );
}
