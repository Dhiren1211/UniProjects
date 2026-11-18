// ============================================================
// DB-backed site settings (Setting key/value rows merged over
// defaults). Admin-editable from the admin panel Settings tab.
// ============================================================

import { db } from "@/lib/db";

export type SiteSettings = {
  /** Global search-bar switch (requirement 2) - header, ⌘K dialog and the projects page. */
  searchEnabled: boolean;
  /** Whether the public account-request form accepts new submissions. */
  accountRequestsOpen: boolean;
  /** Design/branding fields. */
  siteName: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  searchEnabled: true,
  accountRequestsOpen: true,
  siteName: "UniProjects",
  heroTitle: "Kyungsung University Capstone Showcase",
  heroSubtitle:
    "Student teams turn a year of capstone design work into published, searchable projects that are supervised, verified and open to everyone.",
  heroImage: "/hero/ksu-central-library.jpg",
};

type RawValue = string | number | boolean;

function normalize(patch: Partial<Record<keyof SiteSettings, RawValue>>): Partial<Record<keyof SiteSettings, string>> {
  const out: Partial<Record<keyof SiteSettings, string>> = {};
  for (const [k, v] of Object.entries(patch) as [keyof SiteSettings, RawValue][]) {
    if (v === undefined || v === null) continue;
    if (typeof v === "boolean") out[k] = v ? "true" : "false";
    else out[k] = String(v).slice(0, 400);
  }
  return out;
}

/** Read every setting row and merge over defaults. */
export async function getSettings(): Promise<SiteSettings> {
  const rows = await db.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    searchEnabled: (map.get("searchEnabled") ?? String(DEFAULT_SETTINGS.searchEnabled)) === "true",
    accountRequestsOpen:
      (map.get("accountRequestsOpen") ?? String(DEFAULT_SETTINGS.accountRequestsOpen)) === "true",
    siteName: map.get("siteName") ?? DEFAULT_SETTINGS.siteName,
    heroTitle: map.get("heroTitle") ?? DEFAULT_SETTINGS.heroTitle,
    heroSubtitle: map.get("heroSubtitle") ?? DEFAULT_SETTINGS.heroSubtitle,
    heroImage: map.get("heroImage") ?? DEFAULT_SETTINGS.heroImage,
  };
}

/** Persist a partial patch (admin only - callers enforce the role). */
export async function updateSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const entries = Object.entries(normalize(patch));
  await Promise.all(
    entries.map(([key, value]) =>
      db.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
    )
  );
  return getSettings();
}
