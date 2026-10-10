export const MAX_NOTE_TAGS: number;
export const MAX_TAG_LENGTH: number;
export type EditableNote = { content: string; tags: string[] };
export function normalizeNoteTags(input: unknown): string[];
export function parseNoteInput(content: unknown, tags: unknown): EditableNote;
export function noteSignature(note: EditableNote): string;
