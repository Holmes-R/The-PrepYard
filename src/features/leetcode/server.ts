import "server-only";
import { withStudentDatabase } from "@/lib/database/server";
import { fetchPublicAccepted, LeetCodeSyncError } from "./public-api.mjs";
import { claimSync, applyAccepted, recordSyncError } from "./queries.mjs";

export async function syncLeetCode() {
  const claim = await withStudentDatabase(claimSync);
  if (!claim)
    return {
      ok: true,
      skipped: true,
      matched: 0,
      changed: 0,
      message:
        "No sync is due. Checks run at most once every two minutes while connected.",
    };
  try {
    const accepted = await fetchPublicAccepted(claim.username);
    const result = await withStudentDatabase((client) =>
      applyAccepted(client, claim, accepted.submissions),
    );
    return {
      ok: true,
      skipped: result.cancelled,
      ...result,
      message: result.cancelled
        ? "The connection changed. No progress was imported."
        : result.changed
          ? result.changed +
            (result.changed === 1
              ? " question marked as completed."
              : " questions marked as completed.")
          : "Sync complete. No new matching questions to mark.",
    };
  } catch (error) {
    const failure =
      error instanceof LeetCodeSyncError
        ? error
        : new LeetCodeSyncError(
            "Could not sync. Your progress has not been changed.",
          );
    await withStudentDatabase((client) =>
      recordSyncError(client, claim.binding_version, failure.message),
    );
    throw failure;
  }
}
