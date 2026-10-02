import { currentUser } from "@/lib/auth/server";
export async function GET() {
  if (!(await currentUser()))
    return Response.json(
      { error: "Sign in required" },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  return Response.json(
    { status: "ok", application: "the-prepyard" },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
