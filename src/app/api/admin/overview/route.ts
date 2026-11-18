import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { AdminActivityItem, AdminOverviewDTO } from "@/lib/types";
import { likeCountMap, projectInclude, toListItem } from "../../_utils/serialize";
import { requireStaff } from "../_guard";

export const dynamic = "force-dynamic";

// ---------- GET - console-wide counts + recent activity ----------

export async function GET(req: NextRequest) {
  try {
    const gate = await requireStaff(req);
    if (!gate.ok) return gate.denied;

    const [
      users,
      students,
      professors,
      moderators,
      projects,
      published,
      drafts,
      featured,
      verified,
      departments,
      comments,
      resources,
      viewsAgg,
      pendingVerifications,
      openReports,
      pendingJoinRequests,
      pendingAccountRequests,
      byCategoryRows,
      deptRows,
      byClassRows,
      recentProjectRows,
      recentUserRows,
      activityProjectRows,
      activityUserRows,
      activityRequestRows,
      activityCommentRows,
      activityReportRows,
      activityJoinRows,
      activityResourceRows,
      galleryImageCount,
      uploadedResourceCount,
      linkedResourceCount,
      uploadedFileCount,
      signupRows,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: "STUDENT" } }),
      db.user.count({ where: { role: "PROFESSOR" } }),
      db.user.count({ where: { role: "MODERATOR" } }),
      db.project.count(),
      db.project.count({ where: { status: "PUBLISHED" } }),
      db.project.count({ where: { status: "DRAFT" } }),
      db.project.count({ where: { featured: true } }),
      db.project.count({ where: { verified: true } }),
      db.department.count(),
      db.comment.count(),
      db.projectResource.count(),
      db.project.aggregate({ _sum: { views: true } }),
      db.verification.count({ where: { status: "PENDING" } }),
      db.report.count({ where: { status: "OPEN" } }),
      db.joinRequest.count({ where: { status: "PENDING" } }),
      db.accountRequest.count({ where: { status: "PENDING" } }),
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
      // Sections: students + projects grouped per classId.
      Promise.all([
        db.user.groupBy({
          by: ["classId"],
          where: { classId: { not: null } },
          _count: { _all: true },
        }),
        db.project.groupBy({
          by: ["classId"],
          where: { classId: { not: null } },
          _count: { _all: true },
        }),
      ]),
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
      db.accountRequest.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, name: true, status: true, createdAt: true },
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
      db.projectResource.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, label: true, url: true, createdAt: true, project: { select: { title: true, slug: true } } },
      }),
      // ---- storage footprint ----
      db.projectImage.count(),
      db.projectResource.count({ where: { url: { startsWith: "/uploads/" } } }),
      db.projectResource.count({ where: { url: { not: { startsWith: "/uploads/" } } } }),
      // Prisma counts instead of raw SQL: the raw query used unquoted camelCase
      // identifiers, which only worked on SQLite and failed on Postgres.
      Promise.all([
        db.user.count({ where: { avatarUrl: { startsWith: "/uploads/" } } }),
        db.project.count({ where: { coverImage: { startsWith: "/uploads/" } } }),
      ]).then(([avatars, covers]) => [{ n: avatars + covers }]),
      db.user.findMany({ select: { createdAt: true } }),
    ]);

    const [studentClassRows, projectClassRows] = byClassRows;
    const classStudentMap = new Map(
      studentClassRows.map((r) => [r.classId as string, r._count._all])
    );
    const classProjectMap = new Map(
      projectClassRows.map((r) => [r.classId as string, r._count._all])
    );
    const byClass: AdminOverviewDTO["byClass"] = [...new Set([...classStudentMap.keys(), ...classProjectMap.keys()])]
      .sort()
      .map((classId) => ({
        classId,
        students: classStudentMap.get(classId) ?? 0,
        projects: classProjectMap.get(classId) ?? 0,
      }));

    const likeCounts = await likeCountMap(
      "PROJECT",
      recentProjectRows.map((r) => r.id)
    );

    const byCategory = byCategoryRows
      .map((r) => ({ category: r.category, count: r._count._all }))
      .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));

    const [pendingProjectReviews, pendingPasswordResets] = await Promise.all([
      db.project.count({ where: { status: "PENDING" } }),
      db.passwordResetRequest.count({ where: { status: "PENDING" } }),
    ]);

    const overview: AdminOverviewDTO = {
      users,
      students,
      professors,
      moderators,
      projects,
      published,
      drafts,
      featured,
      verified,
      departments,
      comments,
      resources,
      totalViews: viewsAgg._sum.views ?? 0,
      pendingVerifications,
      openReports,
      pendingJoinRequests,
      pendingAccountRequests,
      pendingProjectReviews,
      pendingPasswordResets,
      byCategory,
      byDepartment: deptRows.map((d) => ({
        code: d.code,
        name: d.name,
        accent: d.accent,
        count: d._count.projects,
      })),
      byClass,
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
        requests: activityRequestRows,
        comments: activityCommentRows,
        reports: activityReportRows,
        joins: activityJoinRows,
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
  requests: { id: string; name: string; status: string; createdAt: Date }[];
  comments: { id: string; body: string; createdAt: Date; user: { displayName: string } }[];
  reports: { id: string; reason: string; targetType: string; status: string; createdAt: Date; reporter: { displayName: string } }[];
  joins: { id: string; status: string; createdAt: Date; user: { displayName: string }; project: { title: string; slug: string } }[];
  resources: { id: string; label: string; url: string; createdAt: Date; project: { title: string; slug: string } | null }[];
}): AdminActivityItem[] {
  const items: AdminActivityItem[] = [];

  for (const p of rows.projects) {
    items.push({
      id: `p-${p.id}`,
      kind: "PROJECT",
      text: p.status === "PUBLISHED" ? `New project published - ${p.title}` : `Draft created - ${p.title}`,
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
  for (const r of rows.requests) {
    items.push({
      id: `ar-${r.id}`,
      kind: "ACCOUNT_REQUEST",
      text:
        r.status === "PENDING"
          ? `Account request from ${r.name}`
          : `Account request ${r.status.toLowerCase()} - ${r.name}`,
      createdAt: r.createdAt.toISOString(),
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
