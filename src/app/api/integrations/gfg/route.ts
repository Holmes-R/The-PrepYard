import { currentUser, withAuthRequest } from "@/lib/auth/server";
import { withStudentDatabase } from "@/lib/database/server";
import { privateJson } from "@/lib/http/private-json";
import { sameOriginMutation } from "@/features/leetcode/request-policy.mjs";
import {
  normalizeGfgUsername,
  fetchGfgSnapshot,
  AccountSyncError,
} from "@/features/accounts/public-api.mjs";
import {
  accountSettings,
  connectAccount,
  disconnectAccount,
  setAccountEnabled,
} from "@/features/accounts/queries.mjs";
import { syncGfgAccount } from "@/features/accounts/server";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export function GET() {
  return privateJson(async () => ({
    settings: await withStudentDatabase(accountSettings),
  }));
}
export function POST(request: Request) {
  return withAuthRequest(async () => {
    if (!(await currentUser()))
      return Response.json(
        { error: "Log in required" },
        { status: 401, headers },
      );
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
        throw new AccountSyncError("Invalid request.", 400);
      const text = await request.text();
      if (text.length > 2048)
        throw new AccountSyncError("Invalid request.", 400);
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        throw new AccountSyncError("Invalid request.", 400);
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new AccountSyncError("Invalid request.", 400);
      if (body.action === "sync")
        return Response.json(await syncGfgAccount(), { headers });
      if (body.action === "connect") {
        const username = normalizeGfgUsername(body.username);
        if (!username)
          throw new AccountSyncError(
            "Enter your GeeksforGeeks username, using letters, numbers, underscores or hyphens.",
            400,
          );
        // Validate a complete public baseline before changing any connection.
        const snapshot = await fetchGfgSnapshot(username);
        const settings = await withStudentDatabase((client) =>
          connectAccount(client, snapshot),
        );
        return Response.json({ ok: true, settings }, { headers });
      }
      if (body.action === "disconnect") {
        await withStudentDatabase(disconnectAccount);
        return Response.json({ ok: true, settings: null }, { headers });
      }
      if (body.action === "pause" || body.action === "resume") {
        const settings = await withStudentDatabase((client) =>
          setAccountEnabled(client, body.action === "resume"),
        );
        return Response.json({ ok: true, settings }, { headers });
      }
      throw new AccountSyncError("Invalid action.", 400);
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error:
            error instanceof AccountSyncError
              ? error.message
              : "Sync is temporarily unavailable. Please try again.",
        },
        {
          status: error instanceof AccountSyncError ? error.status : 503,
          headers,
        },
      );
    }
  });
}
