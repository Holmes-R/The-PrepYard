"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Orbit, Menu, X, ArrowUpRight } from "lucide-react";
import { sections } from "@/lib/site";
import { signOut } from "@/lib/auth/actions";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const authPage = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
  ].includes(pathname);
  return (
    <header className="launch-header">
      <div className="launch-nav-shell">
        <Link href="/" className="launch-brand" onClick={() => setOpen(false)}>
          <span>
            <Orbit size={22} />
          </span>
          The PrepYard
        </Link>
        {authPage ? (
          <Link
            className="launch-auth-link"
            href={pathname === "/signup" ? "/login" : "/signup"}
          >
            {pathname === "/signup" ? "Log in" : "Create account"}
            <ArrowUpRight size={15} />
          </Link>
        ) : (
          <>
            <button
              type="button"
              className="launch-menu-toggle"
              aria-label={open ? "Close navigation" : "Open navigation"}
              aria-expanded={open}
              aria-controls="main-navigation"
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
            <nav
              id="main-navigation"
              aria-label="Main navigation"
              className={"launch-nav" + (open ? " is-open" : "")}
            >
              {sections.map(({ href, title }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={
                    pathname === href || pathname.startsWith(href + "/")
                      ? "page"
                      : undefined
                  }
                >
                  {title}
                </Link>
              ))}
              <form action={signOut}>
                <button className="launch-signout">
                  Sign out <ArrowUpRight size={14} />
                </button>
              </form>
            </nav>
          </>
        )}
      </div>
    </header>
  );
}
