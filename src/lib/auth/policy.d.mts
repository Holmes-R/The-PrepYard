export function googleConfigured(
  env?: Record<string, string | undefined>,
): boolean;
export function safeDestination(value: unknown): string;
export function verifiedGoogleIdentity(
  profile:
    { email_verified?: unknown; email?: unknown; sub?: unknown } | undefined,
  account:
    { provider?: unknown; providerAccountId?: unknown } | null | undefined,
): boolean;
export function validStudentId(value: unknown): value is string;
