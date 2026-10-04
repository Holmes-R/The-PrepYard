export const topics = [
  ["arrays", "Arrays"],
  ["strings", "Strings"],
  ["hash-tables", "Hash Tables"],
  ["linked-lists", "Linked Lists"],
  ["stacks", "Stacks"],
  ["queues", "Queues"],
  ["matrices", "Matrices"],
  ["trees", "Trees"],
  ["binary-search-trees", "Binary Search Trees"],
  ["heaps", "Heaps"],
  ["graphs", "Graphs"],
  ["tries", "Tries"],
  ["dynamic-programming", "Dynamic Programming"],
  ["recursion", "Recursion"],
  ["sorting-and-searching", "Sorting and Searching"],
  ["bit-manipulation", "Bit Manipulation"],
  ["mathematics", "Mathematics"],
  ["data-structures", "Data Structures"],
  ["algorithms", "Algorithms"],
];
export function topicFor(tags, groups = []) {
  if (
    groups.some(
      (g) =>
        g.startsWith("DP on ") ||
        [
          "Take / Not take (0/1 Knapsack)",
          "Infinite Supply",
          "Longest Increasing Subsequence",
        ].includes(g),
    )
  )
    return "dynamic-programming";
  if (
    groups.some((g) =>
      [
        "Topological Sort",
        "Union-Find",
        "Breadth First Search (BFS)",
        "Depth First Search (DFS)",
      ].includes(g),
    )
  )
    return "graphs";
  if (groups.includes("Design Data Structure")) return "data-structures";
  const priorities = [
    ["trie", "tries"],
    ["binary-search-tree", "binary-search-trees"],
    ["tree", "trees"],
    ["graph", "graphs"],
    ["linked-list", "linked-lists"],
    ["matrix", "matrices"],
    ["dynamic-programming", "dynamic-programming"],
    ["heap-priority-queue", "heaps"],
    ["stack", "stacks"],
    ["queue", "queues"],
    ["string", "strings"],
    ["array", "arrays"],
    ["hash-table", "hash-tables"],
    ["bit-manipulation", "bit-manipulation"],
    ["math", "mathematics"],
    ["recursion", "recursion"],
    ["sorting", "sorting-and-searching"],
    ["binary-search", "sorting-and-searching"],
  ];
  return priorities.find(([tag]) => tags.includes(tag))?.[1] ?? "algorithms";
}
export const generalPatterns = [
  ["prefix-sum", "Prefix Sum"],
  ["two-pointers", "Two Pointers"],
  ["sliding-window", "Sliding Window"],
  ["monotonic-stack", "Monotonic Stack"],
  ["monotonic-queue", "Monotonic Queue"],
  ["binary-search", "Binary Search"],
  ["breadth-first-search", "Breadth First Search (BFS)"],
  ["depth-first-search", "Depth First Search (DFS)"],
  ["backtracking", "Backtracking"],
  ["topological-sort", "Topological Sort"],
  ["union-find", "Union-Find"],
  ["greedy", "Greedy"],
  ["divide-and-conquer", "Divide and Conquer"],
  ["memoization", "Memoization"],
  ["bitmask", "Bitmask"],
  ["shortest-path", "Shortest Path"],
  ["minimum-spanning-tree", "Minimum Spanning Tree"],
];
export const patternSlug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
