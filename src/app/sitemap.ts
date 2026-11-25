import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/site-url";

// /sitemap.xml - public pages plus every published project, refreshed hourly.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = ["", "/projects", "/announcements", "/guidelines", "/request-account"].map(
    (path) => ({ url: `${SITE_URL}${path}`, changeFrequency: "daily", priority: path ? 0.7 : 1 })
  );
  try {
    const projects = await db.project.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });
    return [
      ...pages,
      ...projects.map((p) => ({
        url: `${SITE_URL}/projects/${encodeURIComponent(p.slug)}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch {
    return pages;
  }
}
