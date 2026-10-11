import "server-only";
import nodemailer from "nodemailer";

export function emailConfigured() {
  return Boolean(
    process.env.GMAIL_USER?.trim() &&
      process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "") &&
      process.env.AUTH_URL,
  );
}

export async function sendAuthEmail(
  email: string,
  token: string,
  purpose: "verify" | "reset",
) {
  const user = process.env.GMAIL_USER?.trim();
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  const authUrl = process.env.AUTH_URL;
  if (!user || !appPassword || !authUrl)
    throw new Error("Email delivery is not configured.");
  const base = new URL(authUrl);
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
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: appPassword },
  });
  await transporter.sendMail({
    from: `PrepYard <${user}>`,
    to: email,
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
  });
}
