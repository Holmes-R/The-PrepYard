import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { authConfigured } from "@/lib/auth/policy.mjs";
import { privateAuthResponse } from "@/lib/auth/response.mjs";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!authConfigured())
    return Response.json(
      { error: "Sign-in is unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  const response = await handlers.GET(request);
  return privateAuthResponse(response);
}
export async function POST(request: NextRequest) {
  if (!authConfigured())
    return Response.json(
      { error: "Sign-in is unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  const response = await handlers.POST(request);
  return privateAuthResponse(response);
}
