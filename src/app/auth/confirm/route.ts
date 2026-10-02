import { NextResponse, type NextRequest } from "next/server";
import { authClient } from "@/lib/auth/server";
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const client = await authClient();
  if (client && token_hash) {
    const { error } = await client.auth.verifyOtp({
      token_hash,
      type: "email",
    });
    if (!error)
      return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.redirect(
    new URL("/login?error=confirmation", request.url),
  );
}
