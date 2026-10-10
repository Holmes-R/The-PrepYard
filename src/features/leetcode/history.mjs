import { LeetCodeSyncError, normalizeUsername } from "./public-api.mjs";

export const MAX_HISTORY_QUESTIONS = 20_000;
export const MAX_HISTORY_BYTES = 4_500_000;

export function parseHistory(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some(
      (key) =>
        !["schema", "username", "bindingVersion", "total", "slugs"].includes(
          key,
        ),
    ) ||
    body.schema !== 1 ||
    !normalizeUsername(body.username) ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(
      body.bindingVersion ?? "",
    ) ||
    !Number.isInteger(body.total) ||
    body.total < 0 ||
    body.total > MAX_HISTORY_QUESTIONS ||
    !Array.isArray(body.slugs) ||
    body.slugs.length !== body.total ||
    body.slugs.some(
      (slug) =>
        typeof slug !== "string" ||
        slug.length > 200 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug),
    ) ||
    new Set(body.slugs).size !== body.total
  )
    throw new LeetCodeSyncError(
      "The solved-question list is invalid or incomplete. No progress was imported.",
      400,
    );
  return { ...body, username: normalizeUsername(body.username) };
}

export async function readHistoryRequest(request) {
  if (Number(request.headers.get("content-length")) > MAX_HISTORY_BYTES)
    throw new LeetCodeSyncError("The history file is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new LeetCodeSyncError("A history list is required.", 400);
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_HISTORY_BYTES) {
        await reader.cancel();
        throw new LeetCodeSyncError("The history file is too large.", 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return parseHistory(
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    );
  } catch (error) {
    if (error instanceof LeetCodeSyncError) throw error;
    throw new LeetCodeSyncError(
      "The solved-question list could not be read.",
      400,
    );
  } finally {
    reader.releaseLock();
  }
}
