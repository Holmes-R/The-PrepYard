export const NOTE_LIMIT: number;
export const NOTE_LANGUAGES: string[][];
export function noteTemplate(kind: string): string;
export type NoteBlock =
  | { kind: "code"; language: string; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "text"; text: string };
export function noteBlocks(content: string): NoteBlock[];
export function insertCode(
  content: string,
  start: number,
  end: number,
  language: string,
): { content: string; cursor: number; end: number };
export type NoteDraft = { version: 1; content: string; base: string };
export type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function draftKey(userId: string, questionId: string): string;
export function readDraft(storage: DraftStorage, key: string): NoteDraft | null;
export function writeDraft(
  storage: DraftStorage,
  key: string,
  content: string,
  base: string,
): boolean;
export function clearDraft(
  storage: DraftStorage,
  key: string,
  savedContent?: string,
): void;
export type SaveStatus = "saved" | "unsaved" | "saving" | "error";
export type NoteAutosave = {
  schedule(value: string): void;
  flush(): Promise<boolean>;
  dispose(): void;
};
export function createNoteAutosave(options: {
  initial?: string;
  save: (value: string) => Promise<void>;
  status: (value: SaveStatus, message?: string) => void;
  delay?: number;
}): NoteAutosave;
