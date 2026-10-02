"use client";
import { useActionState } from "react";
import { continueWithGoogle } from "@/lib/auth/actions";
export function AuthForm({ next = "/dashboard" }: { next?: string }) {
  const [state, action, pending] = useActionState(continueWithGoogle, {
    message: "",
  });
  return (
    <section className="mx-auto my-12 max-w-md rounded-3xl border bg-card p-8">
      <p className="text-sm font-semibold text-primary">
        Free preparation. Your own account.
      </p>
      <h1 className="my-5 text-3xl font-bold">Welcome to The PrepYard</h1>
      <p className="mb-6 text-muted-foreground">
        Use your Google account to access your preparation workspace. Your
        account is created automatically the first time you sign in.
      </p>
      <form action={action} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <button
          disabled={pending}
          className="rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Opening Google…" : "Continue with Google"}
        </button>
        <p role="status" aria-live="polite">
          {state.message}
        </p>
      </form>
      <p className="mt-6 text-sm text-muted-foreground">
        Google handles your sign-in securely. The PrepYard never asks for your
        Google password.
      </p>
    </section>
  );
}
