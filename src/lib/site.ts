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
      "Search, platform filters, difficulty, and company tags will arrive with the catalogue milestone.",
  },
  {
    href: "/companies",
    title: "Companies",
    description: "Prepare for the companies on your list.",
    detail:
      "Company sheets will show source-specific frequency, time windows, and dataset dates.",
  },
  {
    href: "/patterns",
    title: "Patterns",
    description: "Build understanding, one pattern at a time.",
    detail:
      "Curated pattern groups will connect related questions without duplicating your progress.",
  },
  {
    href: "/dashboard",
    title: "My dashboard",
    description: "Make room for steady progress.",
    detail:
      "Guest progress, bookmarks, and a revision queue are planned. Nothing is saved yet.",
  },
  {
    href: "/notes",
    title: "Notes",
    description: "Keep the lessons behind each solution.",
    detail:
      "Private notes and backup export will be implemented with progress storage.",
  },
  {
    href: "/sources",
    title: "Data sources",
    description: "Know where your practice data comes from.",
    detail:
      "Source credits, snapshot dates, and import history will appear here once the first importer is connected.",
  },
] as const;
