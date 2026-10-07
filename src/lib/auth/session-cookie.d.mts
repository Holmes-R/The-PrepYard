export function sessionCookieNames(
  cookies: { name: string }[],
  secure: boolean,
): string[];
export function withoutSessionCookies(
  header: string | null,
  names: string[],
): string;
