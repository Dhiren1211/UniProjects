// ============================================================
// URL <-> View mapping. The app is a single client shell, but every view
// has a real address so links can be shared, refreshed and bookmarked,
// and the browser's Back / Forward buttons work.
//
//   /                          home
//   /projects?q&dept&category&year
//   /projects/<slug>           project detail
//   /projects/<slug>/edit      edit a project
//   /submit                    new project
//   /u/<username>              profile
//   /admin[/<tab>]             admin console
//   /announcements /guidelines /dashboard /settings /notifications
//   /request-account
//
// Shared by the server catch-all page and the client shell - no React here.
// ============================================================

import type { View } from "./api-client";

const SEGMENT = /^[A-Za-z0-9._~-]{1,120}$/;

const SIMPLE = {
  announcements: "announcements",
  guidelines: "guidelines",
  dashboard: "dashboard",
  settings: "settings",
  notifications: "notifications",
  "request-account": "account-request",
} as const satisfies Record<string, View["name"]>;

const enc = encodeURIComponent;

export function viewToPath(v: View): string {
  switch (v.name) {
    case "home":
      return "/";
    case "projects": {
      const q = new URLSearchParams();
      if (v.q) q.set("q", v.q);
      if (v.dept) q.set("dept", v.dept);
      if (v.category) q.set("category", v.category);
      if (v.year) q.set("year", String(v.year));
      const s = q.toString();
      return s ? `/projects?${s}` : "/projects";
    }
    case "project":
      return `/projects/${enc(v.slug)}`;
    case "create":
      return v.editSlug ? `/projects/${enc(v.editSlug)}/edit` : "/submit";
    case "profile":
      return `/u/${enc(v.username)}`;
    case "admin":
      return v.tab ? `/admin/${enc(v.tab)}` : "/admin";
    case "account-request":
      return "/request-account";
    default:
      return `/${v.name}`;
  }
}

type Query = (key: string) => string | undefined;

/** Parse a path (segments, already split) into a view - null when it is not a page of the app. */
export function pathToView(segments: readonly string[], query: Query = () => undefined): View | null {
  const seg = segments.map((s) => {
    try {
      return decodeURIComponent(s);
    } catch {
      return "";
    }
  });
  if (seg.some((s) => !SEGMENT.test(s))) return null;
  const [a, b, c, ...rest] = seg;
  if (rest.length) return null;

  if (a === undefined) return { name: "home" };
  if (a in SIMPLE && b === undefined) return { name: SIMPLE[a as keyof typeof SIMPLE] };

  switch (a) {
    case "projects": {
      if (b === undefined) {
        const year = Number(query("year"));
        return {
          name: "projects",
          q: query("q") || undefined,
          dept: query("dept") || undefined,
          category: query("category") || undefined,
          year: Number.isInteger(year) && year > 0 ? year : undefined,
        };
      }
      if (c === undefined) return { name: "project", slug: b };
      if (c === "edit") return { name: "create", editSlug: b };
      return null;
    }
    case "submit":
      return b === undefined ? { name: "create" } : null;
    case "u":
      return b !== undefined && c === undefined ? { name: "profile", username: b } : null;
    case "admin":
      return c === undefined ? { name: "admin", tab: b } : null;
    default:
      return null;
  }
}

/** Parse the browser's current location. */
export function locationToView(): View {
  const { pathname, search } = window.location;
  const sp = new URLSearchParams(search);
  return pathToView(pathname.split("/").filter(Boolean), (k) => sp.get(k) ?? undefined) ?? { name: "home" };
}

const TITLES: Partial<Record<View["name"], string>> = {
  projects: "Projects",
  announcements: "Announcements",
  guidelines: "Guidelines",
  dashboard: "Dashboard",
  settings: "Settings",
  notifications: "Notifications",
  admin: "Admin",
  create: "Submit a project",
  "account-request": "Request an account",
};

/** Browser-tab title for a view (detail pages refine it once their data loads). */
export function viewTitle(v: View, site: string): string {
  if (v.name === "home") return `${site}: capstone projects from Kyungsung University students`;
  if (v.name === "project") return `Project · ${site}`;
  if (v.name === "profile") return `${v.username} · ${site}`;
  const t = TITLES[v.name];
  return t ? `${t} · ${site}` : site;
}
