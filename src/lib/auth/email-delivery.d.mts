export function emailConfigured(
  env?: Record<string, string | undefined>,
): boolean;
export function sendAuthEmail(
  email: string,
  token: string,
  purpose: "verify" | "reset",
  options?: {
    env?: Record<string, string | undefined>;
    fetchImpl?: typeof fetch;
    createTransport?: typeof import("nodemailer").createTransport;
  },
): Promise<void>;
