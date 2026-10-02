"use server";
import { AuthError } from "next-auth";
import { signIn, signOut as endSession } from "@/auth";
import {
  authConfigured,
  googleConfigured,
  safeDestination,
} from "./policy.mjs";
export type AuthState = { message: string; success?: boolean };
export async function continueWithGoogle(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  if (!googleConfigured())
    return {
      message:
        "Google sign-in is temporarily unavailable. Please try again later.",
    };
  try {
    await signIn("google", { redirectTo: safeDestination(form.get("next")) });
  } catch (error) {
    if (error instanceof AuthError)
      return { message: "Unable to start Google sign-in. Please try again." };
    throw error;
  }
  return { message: "" };
}
export async function signOut() {
  if (authConfigured()) await endSession({ redirectTo: "/login" });
}
