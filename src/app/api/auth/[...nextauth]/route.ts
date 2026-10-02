import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { googleConfigured } from "@/lib/auth/policy.mjs";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!googleConfigured())
    return Response.json(
      { error: "Google sign-in is unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  const response = await handlers.GET(request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export async function POST(request: NextRequest) {
  if (!googleConfigured())
    return Response.json(
      { error: "Google sign-in is unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  const response = await handlers.POST(request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
