import { currentUser, withAuthRequest } from "@/lib/auth/server";
import { withStudentDatabase } from "@/lib/database/server";
import { sameOriginMutation } from "@/features/leetcode/request-policy.mjs";
import { LeetCodeSyncError } from "@/features/leetcode/public-api.mjs";
import { readHistoryRequest } from "@/features/leetcode/history.mjs";
import { applyHistory } from "@/features/leetcode/history-queries.mjs";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
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
      const history = await readHistoryRequest(request);
      return Response.json(
        await withStudentDatabase((client) => applyHistory(client, history)),
        { headers },
      );
    } catch (error) {
      return Response.json(
        {
          ok: false,
          error:
            error instanceof LeetCodeSyncError
              ? error.message
              : "History import is unavailable. Your progress has not been changed.",
        },
        {
          status: error instanceof LeetCodeSyncError ? error.status : 503,
          headers,
        },
      );
    }
  });
}
