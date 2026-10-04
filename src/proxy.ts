import { NextResponse, type NextRequest } from "next/server";
import { passwordSessionValid } from "@/lib/auth/password-server";
import { getToken } from "next-auth/jwt";
import { authConfigured, validStudentId } from "@/lib/auth/policy.mjs";
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const publicRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    ["/forgot-password", "/reset-password", "/verify-email"].includes(
      pathname,
    ) ||
    pathname.startsWith("/api/auth/");
  let signedIn = false;
  if (authConfigured()) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.AUTH_SECRET!,
        secureCookie: request.nextUrl.protocol === "https:",
      });
      signedIn =
        validStudentId(token?.studentId) &&
        typeof token?.passwordVersion === "number";
      if (signedIn && typeof token?.passwordVersion === "number")
        signedIn = await passwordSessionValid(
          token.studentId!,
          token.passwordVersion,
        );
    } catch {
      signedIn = false;
    }
  }
  let response = NextResponse.next();
  if (!signedIn && !publicRoute) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = "";
    target.searchParams.set("next", pathname + request.nextUrl.search);
    response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Sign in required" }, { status: 401 })
      : NextResponse.redirect(target);
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
