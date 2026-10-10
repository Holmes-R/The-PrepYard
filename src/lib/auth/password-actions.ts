"use server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { authConfigured, safeDestination } from "./policy.mjs";
import {
  normalizeEmail,
  validPassword,
  hashPassword,
  newEmailToken,
  tokenDigest,
  validEmailToken,
} from "./password.mjs";
import { allowedAttempt, authQuery } from "./password-server";
import { emailConfigured, sendAuthEmail } from "./email";
import type { AuthState } from "./actions";
const unavailable = {
  message:
    "Email and password access is temporarily unavailable. Please try again later.",
};
function logAuthFailure(operation: string, stage: string, error: unknown) {
  const cause =
    error instanceof Error && "cause" in error ? error.cause : undefined;
  const code =
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : cause instanceof Error &&
          "code" in cause &&
          typeof cause.code === "string"
        ? cause.code
        : undefined;
  console.error(`[auth] ${operation} failed`, {
    stage,
    name: error instanceof Error ? error.name : "UnknownError",
    code,
    ...(error instanceof Error &&
    "status" in error &&
    typeof error.status === "number"
      ? { status: error.status }
      : {}),
  });
}
export async function loginWithPassword(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!authConfigured()) return unavailable;
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirectTo: safeDestination(form.get("next")),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type !== "CredentialsSignin") return unavailable;
      return {
        message:
          "Unable to log in. Check your email and PrepYard password, or verify your email.",
      };
    }
    throw error;
  }
  return { message: "" };
}
export async function requestAccountEmail(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!authConfigured() || !emailConfigured()) return unavailable;
  const email = normalizeEmail(form.get("email"));
  const purpose = form.get("purpose") === "reset" ? "reset" : "verify";
  const password = form.get("password");
  const name = String(form.get("name") || "").trim();
  if (!email) return { message: "Enter a valid email address." };
  if (
    purpose === "verify" &&
    (!validPassword(password) || name.length < 1 || name.length > 200)
  )
    return {
      message: "Enter your name and a PrepYard password of 12–128 characters.",
    };
  if (purpose === "verify" && password !== form.get("confirmPassword"))
    return { message: "The passwords do not match." };
  let stage = "rate_limit";
  try {
    if (!(await allowedAttempt("email", email, 5, 3600)))
      return { message: "Too many requests. Please try again in an hour." };
    stage = "password_hash";
    const hash =
      purpose === "verify" ? await hashPassword(password as string) : null;
    const { token, digest } = newEmailToken();
    stage = "database_token";
    const rows = await authQuery<{ ok: boolean }>(
      "select private.issue_email_token($1,$2,$3,$4,$5) as ok",
      [email, purpose, hash, name, digest],
    );
    if (rows[0].ok) {
      stage = "email_delivery";
      await sendAuthEmail(email, token, purpose);
    }
    return {
      message:
        purpose === "verify"
          ? "If this address can be registered, a verification email is on its way. Check your inbox and spam folder. Already registered? Log in or reset your password."
          : "If an email-and-password account exists for this address, a reset link is on its way.",
    };
  } catch (error) {
    logAuthFailure("Account email request", stage, error);
    return unavailable;
  }
}
export async function completeAccountEmail(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!authConfigured()) return unavailable;
  const token = form.get("token");
  const purpose = form.get("purpose") === "reset" ? "reset" : "verify";
  if (!validEmailToken(token))
    return { message: "This link is invalid. Request a new email." };
  const password = form.get("password");
  if (
    purpose === "reset" &&
    (!validPassword(password) || password !== form.get("confirmPassword"))
  )
    return {
      message: "Use a matching PrepYard password of 12–128 characters.",
    };
  let stage = "rate_limit";
  try {
    if (!(await allowedAttempt("consume", token, 5, 900)))
      return { message: "Too many attempts. Please try again later." };
    stage = "password_hash";
    const hash =
      purpose === "reset" ? await hashPassword(password as string) : null;
    stage = "database_token";
    const rows = await authQuery<{ ok: boolean }>(
      "select private.consume_email_token($1,$2,$3) as ok",
      [tokenDigest(token), purpose, hash],
    );
    return rows[0].ok
      ? {
          message:
            purpose === "verify"
              ? "Email verified. You can now log in."
              : "Password updated. Log in with your new PrepYard password.",
          success: true,
        }
      : {
          message:
            "This link has expired or was already used. Request a new email.",
        };
  } catch (error) {
    logAuthFailure("Email token completion", stage, error);
    return unavailable;
  }
}
