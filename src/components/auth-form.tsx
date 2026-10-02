"use client";
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { continueWithGoogle } from "@/lib/auth/actions";
import {
  loginWithPassword,
  requestAccountEmail,
  completeAccountEmail,
} from "@/lib/auth/password-actions";
type Mode = "login" | "signup" | "forgot" | "verify" | "reset";
const inputClass = "w-full rounded-xl border bg-background px-4 py-3";
export function AuthForm({
  next = "/dashboard",
  mode = "login",
}: {
  next?: string;
  mode?: Mode;
}) {
  const [state, action, pending] = useActionState(
    mode === "login"
      ? loginWithPassword
      : mode === "signup" || mode === "forgot"
        ? requestAccountEmail
        : completeAccountEmail,
    { message: "" },
  );
  const [googleState, googleAction, googlePending] = useActionState(
    continueWithGoogle,
    { message: "" },
  );
  const [token, setToken] = useState("");
  useEffect(() => {
    if (mode === "verify" || mode === "reset") {
      const fragmentToken = new URLSearchParams(
        window.location.hash.slice(1),
      ).get("token");
      if (fragmentToken) {
        // Read browser-only fragment after hydration; retain it across Strict Mode effect replay.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToken(fragmentToken);
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, [mode]);
  const titles = {
    login: "Log in to PrepYard",
    signup: "Create your PrepYard account",
    forgot: "Forgot your password?",
    verify: "Verify your email",
    reset: "Choose a new password",
  };
  const labels = {
    login: "Log in",
    signup: "Create account",
    forgot: "Send reset link",
    verify: "Verify email",
    reset: "Save new password",
  };
  const passwordField =
    mode === "login" || mode === "signup" || mode === "reset";
  return (
    <section className="mx-auto my-12 max-w-md rounded-3xl border bg-card p-8">
      <p className="text-sm font-semibold text-primary">
        Free preparation. Your own account.
      </p>
      <h1 className="my-5 text-3xl font-bold">{titles[mode]}</h1>
      <p className="mb-6 text-muted-foreground">
        {mode === "verify"
          ? "Confirm below to finish creating your account."
          : mode === "forgot"
            ? "Enter the email address you used to create your PrepYard account."
            : "Use your email address and your separate PrepYard password."}
      </p>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <input
          type="hidden"
          name="purpose"
          value={mode === "reset" || mode === "forgot" ? "reset" : "verify"}
        />
        <input type="hidden" name="token" value={token} />
        {mode === "signup" && (
          <label className="grid gap-2">
            Name
            <input
              className={inputClass}
              name="name"
              autoComplete="name"
              required
              maxLength={200}
            />
          </label>
        )}
        {["login", "signup", "forgot"].includes(mode) && (
          <label className="grid gap-2">
            Email address
            <input
              className={inputClass}
              type="email"
              name="email"
              placeholder="you@gmail.com"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
        )}
        {passwordField && (
          <label className="grid gap-2">
            PrepYard password
            <input
              className={inputClass}
              type="password"
              name="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={12}
              maxLength={128}
            />
            <span className="text-sm text-muted-foreground">
              {mode === "login"
                ? "Use your PrepYard password."
                : "Choose 12–128 characters. Do not reuse your Gmail password."}
            </span>
          </label>
        )}
        {(mode === "signup" || mode === "reset") && (
          <label className="grid gap-2">
            Confirm PrepYard password
            <input
              className={inputClass}
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
        )}
        <button
          disabled={
            pending ||
            state.success ||
            ((mode === "verify" || mode === "reset") && !token)
          }
          className="rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Please wait…" : labels[mode]}
        </button>
        <p role="status" aria-live="polite">
          {state.message}
        </p>
        {(mode === "verify" || mode === "reset") &&
          !token &&
          !state.success && (
            <p>
              Open the link from your email. Need another?{" "}
              <Link
                className="underline"
                href={mode === "verify" ? "/signup" : "/forgot-password"}
              >
                Request a new link
              </Link>
              .
            </p>
          )}
      </form>
      {(mode === "login" || mode === "signup") && (
        <>
          <p className="my-5 text-center text-sm text-muted-foreground">or</p>
          <form action={googleAction} className="grid gap-4">
            <input type="hidden" name="next" value={next} />
            <button
              disabled={googlePending}
              className="rounded-full border px-5 py-3 font-semibold disabled:opacity-50"
            >
              {googlePending ? "Opening Google…" : "Continue with Google"}
            </button>
            <p role="status">{googleState.message}</p>
          </form>
        </>
      )}
      <nav
        aria-label="Account options"
        className="mt-6 flex flex-wrap gap-4 text-sm"
      >
        {mode !== "login" && (
          <Link
            className="underline"
            href={"/login?next=" + encodeURIComponent(next)}
          >
            Back to log in
          </Link>
        )}
        {mode === "login" && (
          <>
            <Link
              className="underline"
              href={"/signup?next=" + encodeURIComponent(next)}
            >
              New here? Sign up
            </Link>
            <Link className="underline" href="/forgot-password">
              Forgot password?
            </Link>
          </>
        )}
      </nav>
      {(mode === "login" || mode === "signup") && (
        <p className="mt-6 text-sm text-muted-foreground">
          Already use Google? Continue with Google to keep your existing account
          and progress.
        </p>
      )}
    </section>
  );
}
