import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const publicRoute = ["/login", "/signup", "/auth/confirm"].includes(pathname);
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let signedIn = false;
  if (url && key) {
    const client = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    });
    try {
      const { data, error } = await client.auth.getUser();
      signedIn = Boolean(data.user && !error);
    } catch {
      signedIn = false;
    }
  }
  if (!signedIn && !publicRoute) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = "";
    target.searchParams.set("next", pathname + request.nextUrl.search);
    const denied = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Sign in required" }, { status: 401 })
      : NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
    response = denied;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
