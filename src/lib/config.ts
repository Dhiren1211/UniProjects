// ============================================================
// UniProjects - app-level config for a SINGLE university.
// Change this file to rebrand the whole system.
//
// Brand: Kyungsung University (경성대학교), Busan - est. 1955.
// Official palette: crest blue #005baa, red #d71920, gold #fcaf17,
// portal teal #0097b2 (kscms.ks.ac.kr).
// ============================================================

export const UNIVERSITY = {
  name: "Kyungsung University",
  koreanName: "경성대학교",
  shortName: "KSU",
  tagline: "Student Project Showcase",
  motto: "One campus. Every idea.",
  description:
    "The official showcase of student projects at Kyungsung University - capstones, research builds, and prototypes from every department in Daeyeon-dong, Busan.",
  founded: 1955,
  location: "Suyeong-ro, Nam-gu, Busan",
  domain: "ks.ac.kr",
  logo: "/ks-logo.svg",
  logoWhite: "/ks-logo-white.svg",
} as const;

export const CATEGORIES = [
  "AI & ML",
  "Web & App",
  "IoT & Hardware",
  "Data & Analytics",
  "Design & Media",
  "Security",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const SEMESTERS = ["Spring", "Fall", "Year-long"] as const;

export const YEARS = [2023, 2024, 2025, 2026] as const;

export const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "title", label: "Title A–Z" },
  { value: "popular", label: "Most viewed" },
] as const;

// Lucide icon names used for category covers (mapped in the UI)
export const CATEGORY_ICONS: Record<string, string> = {
  "AI & ML": "BrainCircuit",
  "Web & App": "AppWindow",
  "IoT & Hardware": "Cpu",
  "Data & Analytics": "BarChart3",
  "Design & Media": "Palette",
  Security: "ShieldCheck",
};

// Tailwind classes per department accent - soft tints tuned to the
// Kyungsung teal/blue brand family (crest blue, portal teal, gold, red).
export const ACCENTS: Record<
  string,
  { cover: string; chip: string; dot: string }
> = {
  teal: {
    cover: "from-teal-50 to-cyan-100/60 dark:from-teal-500/20 dark:to-cyan-400/5",
    chip: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-400/10 dark:text-teal-300 dark:border-teal-400/25",
    dot: "bg-teal-500",
  },
  sky: {
    cover: "from-sky-50 to-sky-100/60 dark:from-sky-500/20 dark:to-sky-400/5",
    chip: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-400/10 dark:text-sky-300 dark:border-sky-400/25",
    dot: "bg-sky-500",
  },
  orange: {
    cover: "from-orange-50 to-amber-100/60 dark:from-orange-500/20 dark:to-amber-400/5",
    chip: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-400/10 dark:text-orange-300 dark:border-orange-400/25",
    dot: "bg-orange-500",
  },
  rose: {
    cover: "from-rose-50 to-rose-100/60 dark:from-rose-500/20 dark:to-rose-400/5",
    chip: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-400/10 dark:text-rose-300 dark:border-rose-400/25",
    dot: "bg-rose-500",
  },
  lime: {
    cover: "from-lime-50 to-lime-100/60 dark:from-lime-500/20 dark:to-lime-400/5",
    chip: "bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-400/10 dark:text-lime-300 dark:border-lime-400/25",
    dot: "bg-lime-500",
  },
  cyan: {
    cover: "from-cyan-50 to-cyan-100/60 dark:from-cyan-500/20 dark:to-cyan-400/5",
    chip: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-400/10 dark:text-cyan-300 dark:border-cyan-400/25",
    dot: "bg-cyan-500",
  },
};

export function accentOf(key: string | null | undefined) {
  return ACCENTS[key ?? "teal"] ?? ACCENTS.teal;
}

// Curated avatar gallery - the round number keeps it stable as presets.
// Users can pick one of these or upload their own photo (Settings).
export const AVATAR_PRESETS: string[] = Array.from({ length: 12 }, (_, i) => `/avatars/av${i + 1}.webp`);
