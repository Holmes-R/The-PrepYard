// Public display names; provenance is retained in docs/collection-attribution.md.
export const prepYardCollections = [
  {
    slug: "interview-launchpad",
    name: "Interview Launchpad",
    description: "A focused set of essential interview exercises.",
    kind: "static",
  },
  {
    slug: "dsa-deep-dive",
    name: "DSA Deep Dive",
    description:
      "A broad practice path across core data structures and algorithms.",
    kind: "static",
  },
  {
    slug: "interview-hotlist",
    name: "Interview Hotlist",
    description:
      "The top 20 questions per topic, ranked by peak reported company frequency.",
    kind: "dynamic",
  },
];
export const prepYardCollectionSlugs = prepYardCollections.map((c) => c.slug);
export const staticCollectionSlugs = prepYardCollections
  .filter((c) => c.kind === "static")
  .map((c) => c.slug);
export const hotlistSlug = "interview-hotlist";
