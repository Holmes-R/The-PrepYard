export const site = {
  name: "The PrepYard",
  repository: "https://github.com/Holmes-R/The-PrepYard",
} as const;

export const sections = [
  {
    href: "/explore",
    title: "Explore",
    description: "One place to find coding practice across platforms.",
    detail:
      "Search, platform filters, difficulty, and company tags across the catalogue.",
  },
  {
    href: "/companies",
    title: "Companies",
    description: "Prepare for the companies on your list.",
    detail: "Company sheets prioritize questions by reported frequency.",
  },
  {
    href: "/patterns",
    title: "Patterns",
    description: "Build understanding, one pattern at a time.",
    detail:
      "Curated pattern groups connect related questions without duplicating your progress.",
  },
  {
    href: "/dashboard",
    title: "My dashboard",
    description: "Make room for steady progress.",
    detail:
      "Account progress, bookmarks, and a revision queue, saved to your account.",
  },
  {
    href: "/notes",
    title: "Notes",
    description: "Keep the lessons behind each solution.",
    detail: "Private notes on every question, kept with your progress.",
  },
] as const;
