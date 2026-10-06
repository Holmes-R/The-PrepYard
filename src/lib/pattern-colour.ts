// Deterministic display colour for pattern tags. Every question that carries a
// given pattern shows it in the same colour on both the patterns and companies
// sheets, so the colour becomes a visual identifier for the pattern itself.
export const PATTERN_COLOURS = [
  "#22d3ee", // cyan
  "#f1f5f9", // white
  "#60a5fa", // blue
  "#a78bfa", // purple
  "#fb923c", // orange
  "#f87171", // red
  "#4ade80", // green
  "#f472b6", // pink
];
export function patternColour(slug: string): string {
  let hash = 0;
  for (const character of slug)
    hash = (hash * 31 + character.codePointAt(0)!) % PATTERN_COLOURS.length;
  return PATTERN_COLOURS[hash];
}
