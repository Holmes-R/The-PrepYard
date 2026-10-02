import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { googleConfigured, validStudentId } from "@/lib/auth/policy.mjs";
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const publicRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/api/auth/");
  let signedIn = false;
  if (googleConfigured()) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.AUTH_SECRET!,
        secureCookie: request.nextUrl.protocol === "https:",
      });
      signedIn = validStudentId(token?.studentId);
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
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
