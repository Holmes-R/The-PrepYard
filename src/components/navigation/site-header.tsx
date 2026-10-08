"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  ArrowUpRight,
  LayoutDashboard,
  Building2,
  Code2,
  StickyNote,
  LogOut,
  Search,
  UserRound,
} from "lucide-react";
import { signOut } from "@/lib/auth/actions";

const links = [
  { href: "/dashboard", title: "Dashboard", icon: LayoutDashboard },
  { href: "/companies", title: "Companies", icon: Building2 },
  { href: "/patterns", title: "Practice", icon: Code2 },
  { href: "/notes", title: "Notes", icon: StickyNote },
];

export function SiteHeader({
  user,
}: {
  user?: { name?: string | null; email?: string | null } | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);
  const authPage = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
  ].includes(pathname);
  const name = user?.name || user?.email?.split("@")[0] || "Your account";
  const quickSearchEnabled = !authPage && pathname !== "/";
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        quickSearchEnabled
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [quickSearchEnabled]);
  useEffect(() => {
    if (open)
      panelRef.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
    else if (wasOpen.current) menuRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);
  const brand = (
    <Link
      href={pathname === "/" || !user ? "/" : "/dashboard"}
      className="prep-brand"
      onClick={() => setOpen(false)}
      aria-label={
        pathname === "/" || !user
          ? "The PrepYard home"
          : "The PrepYard dashboard"
      }
    >
      Prep<span>Yard</span>
    </Link>
  );
  if (authPage)
    return (
      <header className="prep-auth-header">
        {brand}
        <Link href={pathname === "/signup" ? "/login" : "/signup"}>
          {pathname === "/signup" ? "Log in" : "Create account"}
          <ArrowUpRight size={15} />
        </Link>
      </header>
    );
  if (pathname === "/") {
    const landingLinks = (
      <nav aria-label="Landing navigation">
        {[
          ["#features", "Features"],
          ["#collections", "Collections"],
          ["#how-it-works", "How it works"],
          ["#faq", "FAQ"],
        ].map(([href, title]) => (
          <a key={href} href={href} onClick={() => setOpen(false)}>
            {title}
          </a>
        ))}
      </nav>
    );
    const accountLinks = (
      <div className="yard-header-auth">
        {user ? (
          <Link
            className="yard-header-signup"
            href="/dashboard"
            onClick={() => setOpen(false)}
          >
            Go to dashboard <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        ) : (
          <>
            <Link
              className="yard-header-login"
              href="/login"
              onClick={() => setOpen(false)}
            >
              Log in
            </Link>
            <Link
              className="yard-header-signup"
              href="/signup"
              onClick={() => setOpen(false)}
            >
              Create account
            </Link>
          </>
        )}
      </div>
    );
    return (
      <header className="prep-landing-navigation">
        <div className="yard-header-inner">
          {brand}
          <div className="yard-header-desktop">
            {landingLinks}
            {accountLinks}
          </div>
          <button
            ref={menuRef}
            type="button"
            className="yard-header-toggle"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            aria-controls="landing-mobile-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? (
              <X size={21} aria-hidden="true" />
            ) : (
              <Menu size={21} aria-hidden="true" />
            )}
          </button>
        </div>
        {open && (
          <div
            ref={panelRef}
            className="yard-header-mobile"
            id="landing-mobile-navigation"
          >
            {landingLinks}
            {accountLinks}
          </div>
        )}
      </header>
    );
  }
  const navigation = (
    <nav aria-label="Main navigation">
      {links.map(({ href, title, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          aria-current={
            pathname === href ||
            pathname.startsWith(href + "/") ||
            (href === "/dashboard" && pathname === "/")
              ? "page"
              : undefined
          }
        >
          <Icon size={17} />
          {title}
        </Link>
      ))}
    </nav>
  );
  return (
    <header className="prep-top-navigation">
      <div className="prep-top-navigation-inner">
        {brand}
        <div className="prep-desktop-navigation">{navigation}</div>
        <form
          className="prep-quick-search"
          action={pathname === "/companies" ? "/companies" : "/patterns"}
        >
          <Search size={16} />
          <input
            ref={searchRef}
            type="search"
            name={pathname === "/companies" ? "find" : "q"}
            placeholder="Quick search…"
            aria-label={
              pathname === "/companies"
                ? "Search companies"
                : "Search practice questions"
            }
            maxLength={100}
          />
          <kbd>Ctrl K</kbd>
        </form>
        <span className="prep-account-status">
          <span />
          Free workspace
        </span>
        <Link
          href="/dashboard"
          className="prep-top-profile"
          aria-label={"Dashboard for " + name}
        >
          <span className="prep-avatar">
            <UserRound size={17} />
          </span>
          <span>
            <strong>{name}</strong>
            <small>Student account</small>
          </span>
        </Link>
        <form className="prep-top-signout" action={signOut}>
          <button aria-label="Log out" title="Log out">
            <LogOut size={18} />
          </button>
        </form>
        <button
          ref={menuRef}
          className="prep-mobile-menu"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
      {open && (
        <div
          id="mobile-navigation"
          className="prep-mobile-navigation"
          ref={panelRef}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const controls = panelRef.current?.querySelectorAll<
              HTMLAnchorElement | HTMLButtonElement
            >("a[href], button:not(:disabled)");
            if (!controls?.length) return;
            const first = controls[0],
              last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              menuRef.current?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              menuRef.current?.focus();
            }
          }}
        >
          {navigation}
          <div className="prep-mobile-account">
            <span>{name}</span>
            <form action={signOut}>
              <button>
                Log out <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
