"use server";
import { redirect } from "next/navigation";
import { authClient } from "./server";
export type AuthState = { message: string };
export async function authenticate(
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const client = await authClient();
  if (!client)
    return {
      message: "Sign-in is temporarily unavailable. Please try again later.",
    };
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const signup = form.get("mode") === "signup";
  if (!email || password.length < 8)
    return {
      message: "Enter your email and a password with at least 8 characters.",
    };
  if (signup) {
    const { data, error } = await client.auth.signUp({ email, password });
    if (error)
      return {
        message:
          "Unable to create an account. Please check your details and try again.",
      };
    if (!data.session)
      return {
        message: "Check your email to confirm your account, then sign in.",
      };
  } else {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error)
      return {
        message:
          "Unable to sign in. Check your email, password, and account confirmation.",
      };
  }
  const next = String(form.get("next") || "/dashboard");
  redirect(
    next.startsWith("/") &&
      !next.startsWith("//") &&
      !next.includes("\\") &&
      !/^\/(login|signup|auth)(\/|\?|$)/.test(next)
      ? next
      : "/dashboard",
  );
}
export async function signOut() {
  const client = await authClient();
  if (client) {
    const { error } = await client.auth.signOut();
    if (error) throw new Error("Unable to sign out. Please try again.");
  }
  redirect("/login");
}
