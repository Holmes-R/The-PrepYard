// Only shared catalogue fields may enter this cache. Personal counts, progress,
// notes, revisions and session data must stay in the authenticated database path.
const fields = new Set([
  "id",
  "slug",
  "name",
  "has_logo",
  "question_count",
  "easy_count",
  "medium_count",
  "hard_count",
  "uses",
  "company",
  "available",
  "topics",
  "patterns",
  "collections",
  "total",
  "position",
]);
function validate(value) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value))
    return;
  if (Array.isArray(value)) {
    value.forEach(validate);
    return;
  }
  if (
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new Error("Catalogue cache accepts plain metadata only");
  for (const [key, item] of Object.entries(value)) {
    if (!fields.has(key))
      throw new Error("Non-catalogue field cannot be shared: " + key);
    validate(item);
  }
}

export function createCatalogueCache({
  ttlMs = 60_000,
  capacity = 128,
  now = Date.now,
  onEvent = () => {},
} = {}) {
  if (ttlMs <= 0 || !Number.isInteger(capacity) || capacity < 1)
    throw new Error("Invalid catalogue cache limits");
  const entries = new Map();
  return {
    clear() {
      entries.clear();
    },
    async read(key, loader) {
      let entry = entries.get(key);
      if (entry && (entry.pending || entry.expires > now())) {
        onEvent(entry.pending ? "wait" : "hit");
        entries.delete(key);
        entries.set(key, entry);
        return structuredClone(
          entry.pending ? await entry.pending : entry.value,
        );
      }
      entries.delete(key);
      onEvent("miss");
      entry = {};
      entries.set(key, entry);
      while (entries.size > capacity)
        entries.delete(entries.keys().next().value);
      entry.pending = Promise.resolve()
        .then(loader)
        .then((value) => {
          validate(value);
          const copy = structuredClone(value);
          if (entries.get(key) === entry) {
            if (value === null) entries.delete(key);
            else {
              entry.value = copy;
              entry.expires = now() + ttlMs;
              entry.pending = null;
            }
          }
          return copy;
        })
        .catch((error) => {
          if (entries.get(key) === entry) entries.delete(key);
          throw error;
        });
      return structuredClone(await entry.pending);
    },
  };
}
