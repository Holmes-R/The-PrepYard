import { NextResponse, type NextRequest } from "next/server";
import { passwordSessionValid } from "@/lib/auth/password-server";
import { getToken } from "next-auth/jwt";
import { authConfigured, validStudentId } from "@/lib/auth/policy.mjs";
import {
  sessionCookieNames,
  withoutSessionCookies,
} from "@/lib/auth/session-cookie.mjs";
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const publicRoute =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    ["/forgot-password", "/reset-password", "/verify-email"].includes(
      pathname,
    ) ||
    pathname.startsWith("/api/auth/");
  const secureCookie = request.nextUrl.protocol === "https:";
  const sessionCookies = sessionCookieNames(
    request.cookies.getAll(),
    secureCookie,
  );
  let invalidSession = false;
  let signedIn = false;
  if (authConfigured()) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.AUTH_SECRET!,
        secureCookie,
      });
      signedIn =
        validStudentId(token?.studentId) &&
        typeof token?.passwordVersion === "number";
      // Clear only unreadable tokens or unsupported legacy claims. A temporary
      // database outage must not be mistaken for a corrupt browser cookie.
      invalidSession = sessionCookies.length > 0 && !signedIn;
      if (signedIn && typeof token?.passwordVersion === "number")
        signedIn = await passwordSessionValid(
          token.studentId!,
          token.passwordVersion,
        );
    } catch {
      signedIn = false;
    }
  }
  const requestHeaders = new Headers(request.headers);
  if (invalidSession) {
    const cookie = withoutSessionCookies(
      requestHeaders.get("cookie"),
      sessionCookies,
    );
    if (cookie) requestHeaders.set("cookie", cookie);
    else requestHeaders.delete("cookie");
  }
  // Prevent RootLayout and auth routes from decoding a rejected cookie again
  // during this request, then expire it in the browser for later requests.
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!signedIn && !publicRoute) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = "";
    target.searchParams.set("next", pathname + request.nextUrl.search);
    response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Sign in required" }, { status: 401 })
      : NextResponse.redirect(target);
  }
  if (invalidSession) {
    for (const name of sessionCookies) {
      response.cookies.set(name, "", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookie,
        maxAge: 0,
      });
    }
  }
  // A stored logo is immutable for a given content hash and sets its own caching and
  // ETag headers. The blanket no-store below would otherwise discard them.
  if (!pathname.startsWith("/api/logos/"))
    response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
