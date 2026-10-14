import "server-only";
import { withStudentDatabase } from "@/lib/database/server";
import { fetchGfgSnapshot, AccountSyncError } from "./public-api.mjs";
import {
  claimAccountSync,
  applySolvedSnapshot,
  recordAccountError,
} from "./queries.mjs";
export async function syncGfgAccount() {
  const claim = await withStudentDatabase(claimAccountSync);
  if (!claim)
    return {
      ok: true,
      skipped: true,
      matched: 0,
      changed: 0,
      message: "No check is due. Checks run at most once every two minutes.",
    };
  try {
    const snapshot = await fetchGfgSnapshot(claim.username);
    const result = await withStudentDatabase((client) =>
      applySolvedSnapshot(client, claim, snapshot),
    );
    return {
      ok: true,
      skipped: result.cancelled,
      ...result,
      message: result.cancelled
        ? "The connection changed. No progress was imported."
        : result.changed
          ? `${result.changed} ${result.changed === 1 ? "question" : "questions"} marked as completed.`
          : "Sync complete. No new matching solves.",
    };
  } catch (error) {
    const failure =
      error instanceof AccountSyncError
        ? error
        : new AccountSyncError(
            "Could not sync. Your progress has not been changed.",
          );
    await withStudentDatabase((client) =>
      recordAccountError(client, claim.binding_version, failure.message),
    );
    throw failure;
  }
}
