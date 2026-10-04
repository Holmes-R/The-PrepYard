"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <section className="dsa-sheet dsa-fallback">
      <h1>Practice sheet is temporarily unavailable</h1>
      <p>Your saved progress is safe. Try loading the sheet again.</p>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
