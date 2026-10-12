import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CommentDTO, PostDTO, ProjectListItem } from "@/lib/types";

// ============================================================
// Shared serializers for routes that need the same DTO shapes
// (bookmarks, search, profile, posts, …). Mirrors the mapping
// in GET /api/projects.
// ============================================================

// ---------- project list shape ----------

export const projectInclude = {
  department: { select: { id: true, name: true, code: true, tagline: true, accent: true } },
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

/** likeCount per polymorphic target (Like.targetId is a plain string — groupBy, never _count). */
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

// ---------- posts ----------

export const postInclude = {
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      avatarUrl: true,
      department: { select: { code: true } },
    },
  },
  comments: { take: 3, orderBy: { createdAt: "desc" as const }, select: commentSelect },
  _count: { select: { comments: true } },
} satisfies Prisma.PostInclude;

export type PostRow = Prisma.PostGetPayload<{ include: typeof postInclude }>;

export function toPostDTO(
  p: PostRow,
  likeCount: number,
  liked: boolean,
  bookmarked: boolean
): PostDTO {
  return {
    id: p.id,
    body: p.body,
    createdAt: p.createdAt.toISOString(),
    user: {
      id: p.user.id,
      username: p.user.username,
      displayName: p.user.displayName,
      role: p.user.role,
      avatarUrl: p.user.avatarUrl,
      departmentCode: p.user.department?.code ?? null,
    },
    likeCount,
    liked,
    bookmarked,
    commentCount: p._count.comments,
    comments: p.comments.map(toCommentDTO),
  };
}

/** Attach viewer flags + polymorphic like counts to post rows. */
export async function mapPosts(rows: PostRow[], viewerId: string | null): Promise<PostDTO[]> {
  const ids = rows.map((r) => r.id);
  const likes = await likeCountMap("POST", ids);
  let likedSet = new Set<string>();
  let bookmarkedSet = new Set<string>();
  if (viewerId && ids.length) {
    const [likedRows, bookmarkedRows] = await Promise.all([
      db.like.findMany({
        where: { userId: viewerId, targetType: "POST", targetId: { in: ids } },
        select: { targetId: true },
      }),
      db.bookmark.findMany({
        where: { userId: viewerId, targetType: "POST", targetId: { in: ids } },
        select: { targetId: true },
      }),
    ]);
    likedSet = new Set(likedRows.map((r) => r.targetId));
    bookmarkedSet = new Set(bookmarkedRows.map((r) => r.targetId));
  }
  return rows.map((r) =>
    toPostDTO(r, likes.get(r.id) ?? 0, likedSet.has(r.id), bookmarkedSet.has(r.id))
  );
}
