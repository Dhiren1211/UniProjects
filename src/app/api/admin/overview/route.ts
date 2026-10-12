import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { AdminActivityItem, AdminOverviewDTO } from "@/lib/types";
import { likeCountMap, projectInclude, toListItem } from "../../_utils/serialize";
import { requireAdmin } from "../_guard";

export const dynamic = "force-dynamic";

// ---------- GET — console-wide counts + recent activity ----------

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const [
      users,
      students,
      faculty,
      projects,
      published,
      drafts,
      featured,
      verified,
      departments,
      events,
      posts,
      comments,
      resources,
      viewsAgg,
      pendingVerifications,
      openReports,
      pendingJoinRequests,
      byCategoryRows,
      deptRows,
      recentProjectRows,
      recentUserRows,
      activityProjectRows,
      activityUserRows,
      activityPostRows,
      activityCommentRows,
      activityReportRows,
      activityJoinRows,
      activityEventRows,
      activityResourceRows,
      galleryImageCount,
      uploadedResourceCount,
      linkedResourceCount,
      uploadedFileCount,
      signupRows,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: "STUDENT" } }),
      db.user.count({ where: { role: { in: ["FACULTY", "ADMIN"] } } }),
      db.project.count(),
      db.project.count({ where: { status: "PUBLISHED" } }),
      db.project.count({ where: { status: "DRAFT" } }),
      db.project.count({ where: { featured: true } }),
      db.project.count({ where: { verified: true } }),
      db.department.count(),
      db.event.count(),
      db.post.count(),
      db.comment.count(),
      db.projectResource.count(),
      db.project.aggregate({ _sum: { views: true } }),
      db.verification.count({ where: { status: "PENDING" } }),
      db.report.count({ where: { status: "OPEN" } }),
      db.joinRequest.count({ where: { status: "PENDING" } }),
      db.project.groupBy({
        by: ["category"],
        where: { status: "PUBLISHED" },
        _count: { _all: true },
      }),
      db.department.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          code: true,
          name: true,
          accent: true,
          _count: { select: { projects: { where: { status: "PUBLISHED" } } } },
        },
      }),
      db.project.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: projectInclude,
      }),
      db.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
        },
      }),
      // ---- activity feed: newest of everything, merged client-side of SQL ----
      db.project.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, slug: true, title: true, status: true, createdAt: true, department: { select: { code: true } } },
      }),
      db.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, username: true, displayName: true, role: true, createdAt: true },
      }),
      db.post.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, body: true, createdAt: true, user: { select: { displayName: true } } },
      }),
      db.comment.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, body: true, createdAt: true, user: { select: { displayName: true } } },
      }),
      db.report.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, reason: true, targetType: true, status: true, createdAt: true, reporter: { select: { displayName: true } } },
      }),
      db.joinRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, status: true, createdAt: true, user: { select: { displayName: true } }, project: { select: { title: true, slug: true } } },
      }),
      db.event.findMany({
        orderBy: { createdAt: "desc" },
        take: 4,
        select: { id: true, title: true, createdAt: true },
      }),
      db.projectResource.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, label: true, url: true, createdAt: true, project: { select: { title: true, slug: true } } },
      }),
      // ---- storage footprint ----
      db.projectImage.count(),
      db.projectResource.count({ where: { url: { startsWith: "/uploads/" } } }),
      db.projectResource.count({ where: { url: { not: { startsWith: "/uploads/" } } } }),
      db.$queryRaw<{ n: number }[]>`
        SELECT (SELECT COUNT(*) FROM User WHERE avatarUrl LIKE '/uploads/%')
             + (SELECT COUNT(*) FROM Project WHERE coverImage LIKE '/uploads/%') AS n
      `,
      db.user.findMany({ select: { createdAt: true } }),
    ]);

    const likeCounts = await likeCountMap(
      "PROJECT",
      recentProjectRows.map((r) => r.id)
    );

    const byCategory = byCategoryRows
      .map((r) => ({ category: r.category, count: r._count._all }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

    const overview: AdminOverviewDTO = {
      users,
      students,
      faculty,
      projects,
      published,
      drafts,
      featured,
      verified,
      departments,
      events,
      posts,
      comments,
      resources,
      totalViews: viewsAgg._sum.views ?? 0,
      pendingVerifications,
      openReports,
      pendingJoinRequests,
      byCategory,
      byDepartment: deptRows.map((d) => ({
        code: d.code,
        name: d.name,
        accent: d.accent,
        count: d._count.projects,
      })),
      recentProjects: recentProjectRows.map((p) => toListItem(p, likeCounts.get(p.id) ?? 0)),
      recentUsers: recentUserRows.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        avatarUrl: u.avatarUrl,
        createdAt: u.createdAt.toISOString(),
      })),
      activity: buildActivity({
        projects: activityProjectRows,
        users: activityUserRows,
        posts: activityPostRows,
        comments: activityCommentRows,
        reports: activityReportRows,
        joins: activityJoinRows,
        events: activityEventRows,
        resources: activityResourceRows,
      }),
      storage: {
        uploadedFiles: Number(uploadedFileCount[0]?.n ?? 0) + uploadedResourceCount + galleryImageCount,
        linkedResources: linkedResourceCount,
        uploadedResources: uploadedResourceCount,
        galleryImages: galleryImageCount,
      },
      signupsByMonth: signupsByMonth(signupRows.map((u) => u.createdAt)),
    };

    return NextResponse.json(overview);
  } catch (e) {
    console.error("GET /api/admin/overview", e);
    return NextResponse.json({ error: "Failed to load the admin overview" }, { status: 500 });
  }
}

// ---------- activity feed helpers ----------

const MAX_ACT = 18;

function buildActivity(rows: {
  projects: { id: string; slug: string; title: string; status: string; createdAt: Date; department: { code: string } | null }[];
  users: { id: string; username: string; displayName: string; role: string; createdAt: Date }[];
  posts: { id: string; body: string; createdAt: Date; user: { displayName: string } }[];
  comments: { id: string; body: string; createdAt: Date; user: { displayName: string } }[];
  reports: { id: string; reason: string; targetType: string; status: string; createdAt: Date; reporter: { displayName: string } }[];
  joins: { id: string; status: string; createdAt: Date; user: { displayName: string }; project: { title: string; slug: string } }[];
  events: { id: string; title: string; createdAt: Date }[];
  resources: { id: string; label: string; url: string; createdAt: Date; project: { title: string; slug: string } | null }[];
}): AdminActivityItem[] {
  const items: AdminActivityItem[] = [];

  for (const p of rows.projects) {
    items.push({
      id: `p-${p.id}`,
      kind: "PROJECT",
      text: p.status === "PUBLISHED" ? `New project published — ${p.title}` : `Draft created — ${p.title}`,
      detail: p.department?.code ?? null,
      createdAt: p.createdAt.toISOString(),
      href: `/project/${p.slug}`,
    });
  }
  for (const u of rows.users) {
    items.push({
      id: `u-${u.id}`,
      kind: "USER",
      text: `${u.displayName} joined the platform`,
      detail: u.role.toLowerCase(),
      createdAt: u.createdAt.toISOString(),
    });
  }
  for (const po of rows.posts) {
    items.push({
      id: `po-${po.id}`,
      kind: "POST",
      text: `${po.user.displayName} posted in the community`,
      detail: po.body.slice(0, 80),
      createdAt: po.createdAt.toISOString(),
      href: "/community",
    });
  }
  for (const c of rows.comments) {
    items.push({
      id: `c-${c.id}`,
      kind: "COMMENT",
      text: `${c.user.displayName} commented`,
      detail: c.body.slice(0, 80),
      createdAt: c.createdAt.toISOString(),
    });
  }
  for (const r of rows.reports) {
    items.push({
      id: `r-${r.id}`,
      kind: "REPORT",
      text: `${r.reporter.displayName} reported a ${r.targetType.toLowerCase()}`,
      detail: r.reason.slice(0, 80),
      createdAt: r.createdAt.toISOString(),
    });
  }
  for (const j of rows.joins) {
    items.push({
      id: `j-${j.id}`,
      kind: "JOIN",
      text: `${j.user.displayName} requested to join ${j.project.title}`,
      detail: j.status.toLowerCase(),
      createdAt: j.createdAt.toISOString(),
      href: `/project/${j.project.slug}`,
    });
  }
  for (const ev of rows.events) {
    items.push({
      id: `e-${ev.id}`,
      kind: "EVENT",
      text: `Event scheduled — ${ev.title}`,
      createdAt: ev.createdAt.toISOString(),
    });
  }
  for (const res of rows.resources) {
    items.push({
      id: `res-${res.id}`,
      kind: "RESOURCE",
      text: `Resource added to ${res.project?.title ?? "a project"}`,
      detail: res.label,
      createdAt: res.createdAt.toISOString(),
      href: res.project ? `/project/${res.project.slug}` : null,
    });
  }

  return items
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_ACT);
}

function signupsByMonth(dates: Date[]): { month: string; count: number }[] {
  const out: { month: string; count: number }[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ month: key, count: 0 });
  }
  const idx = new Map(out.map((o, i) => [o.month, i]));
  for (const dt of dates) {
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const i = idx.get(key);
    if (i !== undefined) out[i].count++;
  }
  return out;
}
