export function normalizeEmail(value: unknown): string | null;
export function validPassword(value: unknown): value is string;
export function hashPassword(password: string): Promise<string>;
export function verifyPassword(
  password: unknown,
  stored: unknown,
): Promise<boolean>;
export function tokenDigest(value: string): string;
export function newEmailToken(): { token: string; digest: string };
export function validEmailToken(value: unknown): value is string;
