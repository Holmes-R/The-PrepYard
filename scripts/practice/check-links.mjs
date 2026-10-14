import { reviewedAlternatives } from "../../src/features/questions/practice.mjs";

let failed = 0;
for (const q of reviewedAlternatives) {
  try {
    const response = await fetch(q.url, { signal: AbortSignal.timeout(20000) });
    const body = await response.text();
    // A status 200 alone can be a login page, bot challenge, or removed problem.
    if (
      !response.ok ||
      !body.toLowerCase().includes(q.title.toLowerCase()) ||
      /Just a moment|verify you are human|cf-chl-/i.test(body)
    )
      throw new Error("Page unavailable or requires manual review");
    console.log(`OK ${q.platform}: ${q.title}`);
  } catch (error) {
    failed++;
    console.error(`REVIEW ${q.title}: ${error.message}`);
  }
}
if (failed) process.exitCode = 1;
