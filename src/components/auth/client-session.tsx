"use client";

import { createContext, useContext } from "react";
import { SWRConfig } from "swr";
import { usePathname } from "next/navigation";
import { useClientResource } from "@/lib/client/use-client-resource";
import { LeetCodeSyncCoordinator } from "@/components/integrations/leetcode-sync-coordinator";
import { SiteHeader } from "@/components/navigation/site-header";

type User = { id: string; name?: string | null; email?: string | null };
const Context = createContext<{ user: User | null; loading: boolean }>({
  user: null,
  loading: true,
});
export const useClientSession = () => useContext(Context);

export function ClientSession({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Refresh when moving into/out of authentication, but avoid a session request
  // on every workspace filter change. APIs still validate every private read.
  const scope =
    pathname === "/"
      ? "landing"
      : [
            "/login",
            "/signup",
            "/forgot-password",
            "/reset-password",
            "/verify-email",
          ].includes(pathname)
        ? pathname
        : "workspace";
  return (
    <SWRConfig key={scope} value={{ provider: () => new Map() }}>
      <SessionState scope={scope}>{children}</SessionState>
    </SWRConfig>
  );
}

function SessionState({
  children,
  scope,
}: {
  children: React.ReactNode;
  scope: string;
}) {
  const { data, loading } = useClientResource<{ user?: User } | null>(
    "/api/auth/session",
    { scope, changes: false },
  );
  const user = data?.user?.id ? data.user : null;
  return (
    <Context.Provider value={{ user, loading }}>
      <SiteHeader user={user} pending={loading} />
      {user && scope === "workspace" && (
        <LeetCodeSyncCoordinator userId={user.id} />
      )}
      {children}
    </Context.Provider>
  );
}
