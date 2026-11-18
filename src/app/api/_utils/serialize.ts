import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CommentDTO, ProjectListItem } from "@/lib/types";

// ============================================================
// Shared serializers for routes that need the same DTO shapes
// (bookmarks, search, profile, posts, …). Mirrors the mapping
// in GET /api/projects.
// ============================================================

// ---------- project list shape ----------

export const projectInclude = {
  department: {
    select: { id: true, name: true, code: true, tagline: true, website: true, capstoneLabel: true, accent: true },
  },
  members: {
    select: {
      id: true,
      role: true,
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          department: { select: { code: true } },
        },
      },
    },
    orderBy: { joinedAt: "asc" as const },
  },
  technologies: {
    select: { technology: { select: { id: true, name: true, slug: true, category: true } } },
  },
} satisfies Prisma.ProjectInclude;

export type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

export function toListItem(p: ProjectRow, likeCount = 0): ProjectListItem {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    coverImage: p.coverImage,
    category: p.category,
    year: p.year,
    semester: p.semester,
    supervisor: p.supervisor,
    classId: p.classId,
    tags: p.tags ? p.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    demoUrl: p.demoUrl,
    repoUrl: p.repoUrl,
    featured: p.featured,
    verified: p.verified,
    status: p.status,
    lookingForTeammates: p.lookingForTeammates,
    views: p.views,
    createdAt: p.createdAt.toISOString(),
    department: p.department,
    members: p.members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.displayName,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      departmentCode: m.user.department?.code ?? null,
    })),
    technologies: p.technologies.map((t) => t.technology),
    likeCount,
  };
}

/** likeCount per polymorphic target (Like.targetId is a plain string - groupBy, never _count). */
export async function likeCountMap(
  targetType: string,
  ids: string[]
): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const rows = await db.like.groupBy({
    by: ["targetId"],
    where: { targetType, targetId: { in: ids } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.targetId, r._count._all]));
}

// ---------- supervisor → professor resolution ----------

/**
 * The Project.supervisor column stores a free-text name ("Prof. Dana Kim").
 * To link it to the matching PROFESSOR account we normalise both sides:
 * lowercase, title prefixes and dots stripped - "Prof. Dana Kim" → "dana kim".
 */
export function normalizeSupervisorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(prof\.?|dr\.?|professor)\s+/i, "")
    .replace(/\./g, "")
    .trim();
}

type SupervisorEntry = { username: string; displayName: string; avatarUrl: string | null };

let supervisorCache: { map: Map<string, SupervisorEntry>; at: number } | null = null;
const SUPERVISOR_TTL_MS = 60_000;

/**
 * Map of every PROFESSOR account by normalised display name.
 * Cached for 60s - the faculty table is tiny and rarely changes.
 */
export async function professorSupervisorMap(): Promise<Map<string, SupervisorEntry>> {
  if (supervisorCache && Date.now() - supervisorCache.at < SUPERVISOR_TTL_MS) {
    return supervisorCache.map;
  }
  const professors = await db.user.findMany({
    where: { role: "PROFESSOR" },
    select: { username: true, displayName: true, avatarUrl: true },
  });
  const map = new Map<string, SupervisorEntry>();
  for (const p of professors) {
    map.set(normalizeSupervisorName(p.displayName), {
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
    });
  }
  supervisorCache = { map, at: Date.now() };
  return map;
}

/**
 * Fresh (uncached) lookup of a registered PROFESSOR account by free-text
 * name - "Prof. Dana Kim" and "dana kim" both resolve to Dana Kim's row.
 * Used for class-ID inheritance: students who name a registered professor
 * share that professor's classID. Always fresh so the admin console and
 * the request form reflect classID edits immediately.
 */
export async function resolveProfessorByName(name: string): Promise<{
  id: string;
  username: string;
  displayName: string;
  classId: string | null;
} | null> {
  const key = normalizeSupervisorName(name);
  if (!key) return null;
  const professors = await db.user.findMany({
    where: { role: "PROFESSOR" },
    select: { id: true, username: true, displayName: true, classId: true },
  });
  const match = professors.find((p) => normalizeSupervisorName(p.displayName) === key);
  return match ?? null;
}

// ---------- comments ----------

export const commentSelect = {
  id: true,
  body: true,
  createdAt: true,
  user: { select: { id: true, username: true, displayName: true, role: true, avatarUrl: true } },
} satisfies Prisma.CommentSelect;

export type CommentRow = Prisma.CommentGetPayload<{ select: typeof commentSelect }>;

export function toCommentDTO(c: CommentRow): CommentDTO {
  return { id: c.id, body: c.body, createdAt: c.createdAt.toISOString(), user: c.user };
}
