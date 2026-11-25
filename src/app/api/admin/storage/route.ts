import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getStorageConfig, updateStorageConfig } from "@/lib/admin-config";
import { requireAdmin } from "../_guard";
import type { StorageReportDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/storage - database capacity, used / free space and a
//                          per-category breakdown (ADMIN only).
// PUT /api/admin/storage - capacity + image compression settings.
//
// "Used" is Postgres' own measurement (pg_database_size) - the figure
// Neon's plan limit is checked against. Categories split it by table;
// the UploadedFile table is further split by file kind, so the
// categories always add up to the total.
// ============================================================

/** Table → category. Anything unlisted (catalogs, Setting, …) lands in "System". */
const TABLE_GROUPS: Record<string, string> = {
  Project: "content",
  ProjectMember: "content",
  Technology: "content",
  ProjectTechnology: "content",
  ProjectImage: "content",
  ProjectResource: "content",
  ProjectTimeline: "content",
  Comment: "content",
  Like: "content",
  Bookmark: "content",
  Follow: "content",
  JoinRequest: "content",
  Verification: "content",
  Report: "content",
  Announcement: "content",
  Department: "content",
  User: "accounts",
  Session: "accounts",
  AccountRequest: "accounts",
  PasswordResetRequest: "accounts",
  Notification: "accounts",
  EmailLog: "logs",
  AuditLog: "logs",
  RateLimit: "logs",
};

/** File kind → category. */
const FILE_GROUPS: Record<string, string> = {
  cover: "projectImages",
  gallery: "projectImages",
  resource: "projectFiles",
  avatar: "avatars",
  hero: "siteImages",
};

const CATEGORY_META: { key: string; label: string; hint: string }[] = [
  { key: "projectImages", label: "Project images", hint: "Cover and gallery photos" },
  { key: "projectFiles", label: "Project files", hint: "Uploaded PDFs, slides, docs and archives" },
  { key: "avatars", label: "Profile pictures", hint: "Member avatars" },
  { key: "siteImages", label: "Site images", hint: "Landing-page hero photo" },
  { key: "content", label: "Projects & content", hint: "Project text, comments, likes, announcements" },
  { key: "accounts", label: "Users & accounts", hint: "Members, sessions, requests, notifications" },
  { key: "logs", label: "Logs & emails", hint: "Email outbox, activity log, rate limits" },
  { key: "system", label: "System & indexes", hint: "Postgres catalogs, settings and free-space overhead" },
];

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.denied;

  try {
    const [config, dbSizeRows, tableRows, fileGroups, pendingImages, imageCount] = await Promise.all([
      getStorageConfig(),
      db.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database())::bigint AS size`,
      db.$queryRaw<{ name: string; size: bigint }[]>`
        SELECT relname AS name, pg_total_relation_size(relid)::bigint AS size
        FROM pg_catalog.pg_statio_user_tables`,
      db.uploadedFile.groupBy({ by: ["kind"], _sum: { size: true }, _count: { _all: true } }),
      db.uploadedFile.count({
        where: { compressed: false, mime: { in: ["image/jpeg", "image/png", "image/webp"] } },
      }),
      db.uploadedFile.count({ where: { mime: { startsWith: "image/" } } }),
    ]);

    const usedBytes = Number(dbSizeRows[0]?.size ?? 0);
    const capacityBytes = config.capacityMb * 1024 * 1024;
    const bytes: Record<string, number> = Object.fromEntries(CATEGORY_META.map((c) => [c.key, 0]));
    const counts: Record<string, number> = {};

    // tables → categories (the UploadedFile table is split by file kind below)
    let uploadsTable = 0;
    for (const row of tableRows) {
      const size = Number(row.size);
      if (row.name === "UploadedFile") uploadsTable = size;
      else bytes[TABLE_GROUPS[row.name] ?? "system"] += size;
    }

    // UploadedFile table → file kinds, in proportion to the bytes each kind stores
    const totalFileBytes = fileGroups.reduce((s, g) => s + (g._sum.size ?? 0), 0);
    for (const g of fileGroups) {
      const key = FILE_GROUPS[g.kind] ?? "projectFiles";
      const share = totalFileBytes > 0 ? (g._sum.size ?? 0) / totalFileBytes : 0;
      bytes[key] += Math.round(uploadsTable * share);
      counts[key] = (counts[key] ?? 0) + g._count._all;
    }
    if (totalFileBytes === 0) bytes.system += uploadsTable;

    // whatever the tables don't explain (catalogs, free-space map, …) is "System"
    const accounted = Object.values(bytes).reduce((s, n) => s + n, 0);
    if (usedBytes > accounted) bytes.system += usedBytes - accounted;

    const report: StorageReportDTO = {
      capacityBytes,
      usedBytes,
      freeBytes: Math.max(0, capacityBytes - usedBytes),
      categories: CATEGORY_META.map((c) => ({
        key: c.key,
        label: c.label,
        hint: c.hint,
        bytes: bytes[c.key],
        files: counts[c.key] ?? null,
      })),
      images: { total: imageCount, uncompressed: pendingImages },
      config,
    };
    return NextResponse.json(report);
  } catch (e) {
    console.error("GET /api/admin/storage", e);
    return NextResponse.json({ error: "Failed to measure storage" }, { status: 500 });
  }
}

const putSchema = z.object({
  capacityMb: z.coerce.number().int().min(64, "Capacity must be at least 64 MB").max(1024 * 1024).optional(),
  compress: z.boolean().optional(),
  maxEdge: z.coerce.number().int().min(640).max(4096).optional(),
  quality: z.coerce.number().int().min(40).max(95).optional(),
});

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.denied;
  try {
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
    }
    const config = await updateStorageConfig(parsed.data);
    await audit(gate.viewer, "settings.update", { type: "SETTINGS", label: "Storage & image settings" }, Object.keys(parsed.data).join(", ") || null);
    return NextResponse.json({ config });
  } catch (e) {
    console.error("PUT /api/admin/storage", e);
    return NextResponse.json({ error: "Failed to save the storage settings" }, { status: 500 });
  }
}
