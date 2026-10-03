"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto max-w-6xl p-8">
      <h1 className="text-3xl font-semibold">
        Questions are temporarily unavailable
      </h1>
      <p className="my-4">Please try again in a moment.</p>
      <button
        onClick={reset}
        className="rounded-full bg-primary px-5 py-3 text-primary-foreground"
      >
        Try again
      </button>
    </section>
  );
}
