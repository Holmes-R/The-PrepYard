// Public display names; provenance is retained in docs/collection-attribution.md.
export const prepYardCollections = [
  {
    slug: "interview-launchpad",
    name: "Interview Launchpad",
    description:
      "A compact set of essential interview questions. Practice core techniques without taking on a long sheet.",
    bestFor: "Building a foundation or a quick interview refresher.",
    kind: "static",
  },
  {
    slug: "dsa-deep-dive",
    name: "DSA Deep Dive",
    description:
      "A broader path across data structures and algorithms, with questions from multiple coding platforms. Work topic by topic to strengthen your understanding.",
    bestFor: "Steady preparation and deeper topic coverage.",
    kind: "static",
  },
  {
    slug: "interview-hotlist",
    name: "Interview Hotlist",
    description:
      "Up to 20 questions per topic, ranked by the highest reported company frequency. Use this shorter list to decide what to practice first.",
    bestFor: "Prioritizing practice when your preparation time is limited.",
    kind: "dynamic",
  },
];
export const prepYardCollectionSlugs = prepYardCollections.map((c) => c.slug);
export const staticCollectionSlugs = prepYardCollections
  .filter((c) => c.kind === "static")
  .map((c) => c.slug);
export const hotlistSlug = "interview-hotlist";
