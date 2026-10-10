import { currentUser, withAuthRequest } from "@/lib/auth/server";
import { withStudentDatabase } from "@/lib/database/server";
import { privateJson } from "@/lib/http/private-json";
import {
  normalizeUsername,
  LeetCodeSyncError,
} from "@/features/leetcode/public-api.mjs";
import {
  syncSettings,
  connectProfile,
  disconnectProfile,
  setSyncEnabled,
} from "@/features/leetcode/queries.mjs";
import { sameOriginMutation } from "@/features/leetcode/request-policy.mjs";
import { syncLeetCode } from "@/features/leetcode/server";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export function GET() {
  return privateJson(async () => ({
    settings: await withStudentDatabase(syncSettings),
  }));
}

export async function POST(request: Request) {
  return withAuthRequest(async () => {
    if (!(await currentUser()))
      return Response.json(
        { error: "Log in required" },
        { status: 401, headers },
      );
    // No public cross-origin mutation endpoint. The browser sends JSON from our own origin.
    if (
      !sameOriginMutation(request) ||
      !request.headers.get("content-type")?.startsWith("application/json")
    )
      return Response.json(
        { error: "Invalid request" },
        { status: 403, headers },
      );
    try {
      if (Number(request.headers.get("content-length")) > 2048)
        throw new LeetCodeSyncError("Invalid request.", 400);
      const text = await request.text();
      if (text.length > 2048)
        throw new LeetCodeSyncError("Invalid request.", 400);
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new LeetCodeSyncError("Invalid request.", 400);
      }
      if (!body || typeof body !== "object")
        throw new LeetCodeSyncError("Invalid request.", 400);
      if (body.action === "sync")
        return Response.json(await syncLeetCode(), { headers });
      if (body.action === "connect") {
        const username = normalizeUsername(body.username);
        if (!username)
          throw new LeetCodeSyncError(
            "Enter your LeetCode username, using letters, numbers, underscores, or hyphens.",
            400,
          );
        const settings = await withStudentDatabase((client) =>
          connectProfile(client, username),
        );
        return Response.json({ ok: true, settings }, { headers });
      }
      if (body.action === "disconnect") {
        await withStudentDatabase(disconnectProfile);
        return Response.json({ ok: true, settings: null }, { headers });
      }
      if (body.action === "pause" || body.action === "resume") {
        const settings = await withStudentDatabase((client) =>
          setSyncEnabled(client, body.action === "resume"),
        );
        return Response.json({ ok: true, settings }, { headers });
      }
      throw new LeetCodeSyncError("Invalid action.", 400);
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error:
            error instanceof LeetCodeSyncError
              ? error.message
              : "Sync is temporarily unavailable. Please try again.",
        },
        {
          status: error instanceof LeetCodeSyncError ? error.status : 503,
          headers,
        },
      );
    }
  });
}
