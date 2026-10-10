import "server-only";
export class EmailDeliveryError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number) {
    super("Email provider rejected the delivery request.");
    this.name = "EmailDeliveryError";
    this.code = "RESEND_HTTP_" + status;
    this.status = status;
  }
}

export function emailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY &&
    process.env.AUTH_EMAIL_FROM &&
    process.env.AUTH_URL,
  );
}
export async function sendAuthEmail(
  email: string,
  token: string,
  purpose: "verify" | "reset",
) {
  if (!emailConfigured()) throw new Error("Email delivery is not configured.");
  const base = new URL(process.env.AUTH_URL!);
  if (
    base.protocol !== "https:" &&
    !(
      base.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)
    )
  )
    throw new Error("Use HTTPS for AUTH_URL.");
  const link = new URL(
    purpose === "verify" ? "/verify-email" : "/reset-password",
    base.origin,
  );
  // Fragments keep tokens out of server access logs and HTTP referrers.
  link.hash = new URLSearchParams({ token }).toString();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM,
      to: [email],
      subject:
        purpose === "verify"
          ? "Verify your PrepYard email"
          : "Reset your PrepYard password",
      text:
        (purpose === "verify"
          ? "Confirm your email to create your PrepYard account. This link expires in one hour."
          : "Choose a new PrepYard password. This link expires in 30 minutes.") +
        "\n\n" +
        link.href +
        "\n\nIf you did not request this, ignore this email.",
    }),
  });
  if (!response.ok) throw new EmailDeliveryError(response.status);
}
