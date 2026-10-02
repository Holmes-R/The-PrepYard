"use client";
import Link from "next/link";
import { useActionState } from "react";
import { authenticate } from "@/lib/auth/actions";
export function AuthForm({
  signup = false,
  next = "/dashboard",
}: {
  signup?: boolean;
  next?: string;
}) {
  const [state, action, pending] = useActionState(authenticate, {
    message: "",
  });
  return (
    <section className="mx-auto my-12 max-w-md rounded-3xl border bg-card p-8">
      <p className="text-sm font-semibold text-primary">
        Free preparation. Your own account.
      </p>
      <h1 className="my-5 text-3xl font-bold">
        {signup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mb-6 text-muted-foreground">
        Sign in to access your preparation workspace.
      </p>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="mode" value={signup ? "signup" : "login"} />
        <input type="hidden" name="next" value={next} />
        <label className="grid gap-2">
          Email
          <input
            className="rounded-lg border p-3"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label className="grid gap-2">
          Password
          <input
            className="rounded-lg border p-3"
            name="password"
            type="password"
            minLength={8}
            autoComplete={signup ? "new-password" : "current-password"}
            required
          />
        </label>
        <p role="status" aria-live="polite">
          {state.message}
        </p>
        <button
          disabled={pending}
          className="rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Please wait…" : signup ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm">
        {signup ? "Already have an account? " : "New here? "}
        <Link className="underline" href={signup ? "/login" : "/signup"}>
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </section>
  );
}
