import { authClient } from "@/lib/auth/server";
export async function GET() {
  const client = await authClient();
  const result = client ? await client.auth.getUser() : null;
  if (!result?.data.user || result.error)
    return Response.json({ error: "Sign in required" }, { status: 401 });
  return Response.json(
    { status: "ok", application: "the-prepyard" },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
