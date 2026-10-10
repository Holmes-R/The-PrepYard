export const MAX_NOTE_TAGS = 8;
export const MAX_TAG_LENGTH = 32;
export function normalizeNoteTags(input) {
  if (!Array.isArray(input) || input.length > MAX_NOTE_TAGS)
    throw new Error("Use up to 8 tags per note.");
  const tags = [],
    seen = new Set();
  for (const value of input) {
    if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value))
      throw new Error("Tags must be plain text on one line.");
    const tag = value.trim().replace(/\s+/gu, " ");
    if (!tag || tag.length > MAX_TAG_LENGTH)
      throw new Error("Each tag must contain 1–32 characters.");
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      tags.push(tag);
      seen.add(key);
    }
  }
  return tags;
}
export function parseNoteInput(content, tags) {
  if (typeof content !== "string" || content.length > 50000)
    throw new Error("Notes can contain up to 50,000 characters.");
  return { content: content.trim(), tags: normalizeNoteTags(tags) };
}
export function noteSignature(note) {
  return JSON.stringify({ content: note.content.trim(), tags: note.tags });
}
