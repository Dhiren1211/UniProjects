import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, isStaff } from "@/lib/auth";
import { CATEGORIES, SEMESTERS } from "@/lib/config";
import type { ProjectDetail, ViewerDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const detailInclude = {
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
  resources: { select: { id: true, type: true, label: true, url: true }, orderBy: { createdAt: "asc" as const } },
  images: { select: { id: true, url: true }, orderBy: { sortOrder: "asc" as const } },
  timeline: { select: { id: true, title: true, date: true, note: true }, orderBy: { date: "asc" as const } },
  comments: {
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: { select: { id: true, username: true, displayName: true, role: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.ProjectInclude;

type DetailRow = Prisma.ProjectGetPayload<{ include: typeof detailInclude }>;

function toDetail(p: DetailRow, likeCount = 0): ProjectDetail {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    summary: p.summary,
    description: p.description,
    coverImage: p.coverImage,
    category: p.category,
    year: p.year,
    semester: p.semester,
    program: p.program,
    supervisor: p.supervisor,
    tags: p.tags ? p.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    demoUrl: p.demoUrl,
    repoUrl: p.repoUrl,
    featured: p.featured,
    verified: p.verified,
    status: p.status,
    lookingForTeammates: p.lookingForTeammates,
    allowJoinRequests: p.allowJoinRequests,
    views: p.views,
    createdAt: p.createdAt.toISOString(),
    department: p.department,
    ownerId: p.ownerId,
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
    resources: p.resources,
    galleryImages: p.images.map((i) => i.url),
    timeline: p.timeline.map((t) => ({ id: t.id, title: t.title, date: t.date.toISOString(), note: t.note })),
    comments: p.comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      user: c.user,
    })),
    likeCount,
  };
}

async function buildViewer(
  req: NextRequest,
  project: { id: string; ownerId: string | null; verified: boolean; allowJoinRequests: boolean }
): Promise<ViewerDTO> {
  const viewer = await getSessionUser(req);
  if (!viewer) {
    return {
      user: null,
      isOwner: false,
      isMember: false,
      bookmarked: false,
      following: false,
      liked: false,
      joinRequestStatus: null,
      canVerify: false,
    };
  }
  const [member, bookmark, follow, like, joinReq] = await Promise.all([
    db.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: viewer.id } },
    }),
    db.bookmark.findUnique({
      where: { userId_targetType_targetId: { userId: viewer.id, targetType: "PROJECT", targetId: project.id } },
    }),
    db.follow.findUnique({
      where: { followerId_targetType_targetId: { followerId: viewer.id, targetType: "PROJECT", targetId: project.id } },
    }),
    db.like.findUnique({
      where: { userId_targetType_targetId: { userId: viewer.id, targetType: "PROJECT", targetId: project.id } },
    }),
    db.joinRequest.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: viewer.id } },
    }),
  ]);

  return {
    user: {
      id: viewer.id,
      username: viewer.username,
      displayName: viewer.displayName,
      email: viewer.email,
      role: viewer.role,
      bio: viewer.bio,
      avatarUrl: viewer.avatarUrl,
      program: viewer.program,
      skills: viewer.skills ? viewer.skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
      website: viewer.website,
      github: viewer.github,
      lookingForTeammates: viewer.lookingForTeammates,
      department: viewer.department,
      createdAt: viewer.createdAt.toISOString(),
    },
    isOwner: project.ownerId === viewer.id || isStaff(viewer.role),
    isMember: !!member,
    bookmarked: !!bookmark,
    following: !!follow,
    liked: !!like,
    joinRequestStatus: (joinReq?.status as ViewerDTO["joinRequestStatus"]) ?? null,
    canVerify: isStaff(viewer.role) && !project.verified,
  };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const p = await db.project.findUnique({ where: { slug }, include: detailInclude });

    if (!p) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const likeCount = await db.like.count({
      where: { targetType: "PROJECT", targetId: p.id },
    });
    const viewer = await buildViewer(req, p);

    // drafts are only visible to the owner / staff
    if (p.status !== "PUBLISHED" && !viewer.isOwner) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    db.project.update({ where: { id: p.id }, data: { views: { increment: 1 } } }).catch(() => {});

    return NextResponse.json({ project: toDetail(p, likeCount), viewer });
  } catch (e) {
    console.error("GET /api/projects/[slug]", e);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
}

// ---------- PATCH (owner / staff) ----------

/** Cover / gallery targets: uploaded paths or any in-app image path, or an external https link. */
const isImageTarget = (v: string) => /^(https?:\/\/|\/(uploads|covers|gallery)\/)\S+$/i.test(v);
const imageTargetSchema = z
  .string()
  .trim()
  .min(1, "Add a cover image — upload one or paste a link")
  .max(300)
  .refine(isImageTarget, "Cover must be an uploaded file, an in-app image path, or an https link");

const patchSchema = z.object({
  title: z.string().trim().min(4).max(120).optional(),
  summary: z.string().trim().min(20).max(220).optional(),
  description: z.string().trim().min(60).max(6000).optional(),
  category: z.enum(CATEGORIES).optional(),
  year: z.coerce.number().int().min(2020).max(2030).optional(),
  semester: z.enum(SEMESTERS).optional(),
  program: z.string().trim().max(80).optional(),
  supervisor: z.string().trim().max(80).optional(),
  dept: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).optional(),
  demoUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  repoUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  allowJoinRequests: z.boolean().optional(),
  lookingForTeammates: z.boolean().optional(),
  technologyIds: z.array(z.string()).max(20).optional(),
  coverImage: imageTargetSchema.optional(),
  galleryImages: z
    .array(
      z
        .string()
        .trim()
        .max(300)
        .refine(isImageTarget, "Gallery entries must be image links or uploads")
    )
    .max(8, "Up to 8 gallery images")
    .optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

    const project = await db.project.findUnique({ where: { slug } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const owner = project.ownerId === viewer.id || isStaff(viewer.role);
    if (!owner) return NextResponse.json({ error: "Only the project owner can edit it" }, { status: 403 });

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    if (d.dept) {
      const department = await db.department.findUnique({ where: { code: d.dept } });
      if (!department) return NextResponse.json({ error: "Unknown department" }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (d.title !== undefined) data.title = d.title;
    if (d.summary !== undefined) data.summary = d.summary;
    if (d.description !== undefined) data.description = d.description;
    if (d.category !== undefined) data.category = d.category;
    if (d.year !== undefined) data.year = d.year;
    if (d.semester !== undefined) data.semester = d.semester;
    if (d.program !== undefined) data.program = d.program || null;
    if (d.supervisor !== undefined) data.supervisor = d.supervisor || null;
    if (d.dept !== undefined) data.departmentId = (await db.department.findUnique({ where: { code: d.dept } }))!.id;
    if (d.tags !== undefined) data.tags = d.tags.map((t) => t.toLowerCase()).join(",");
    if (d.demoUrl !== undefined) data.demoUrl = d.demoUrl || null;
    if (d.repoUrl !== undefined) data.repoUrl = d.repoUrl || null;
    if (d.status !== undefined) data.status = d.status;
    if (d.allowJoinRequests !== undefined) data.allowJoinRequests = d.allowJoinRequests;
    if (d.lookingForTeammates !== undefined) data.lookingForTeammates = d.lookingForTeammates;
    if (d.coverImage !== undefined) data.coverImage = d.coverImage;

    await db.project.update({ where: { id: project.id }, data });

    if (d.galleryImages) {
      await db.projectImage.deleteMany({ where: { projectId: project.id } });
      const urls = [...new Set(d.galleryImages.map((u) => u.trim()).filter(Boolean))];
      if (urls.length) {
        await db.projectImage.createMany({
          data: urls.map((url, i) => ({ projectId: project.id, url, sortOrder: i })),
        });
      }
    }

    if (d.technologyIds) {
      const valid = await db.technology.findMany({ where: { id: { in: d.technologyIds } } });
      await db.projectTechnology.deleteMany({ where: { projectId: project.id } });
      if (valid.length) {
        await db.projectTechnology.createMany({
          data: valid.map((t) => ({ projectId: project.id, technologyId: t.id })),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/projects/[slug]", e);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

// ---------- DELETE (owner / staff) ----------

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in first" }, { status: 401 });

    const project = await db.project.findUnique({ where: { slug } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (project.ownerId !== viewer.id && !isStaff(viewer.role)) {
      return NextResponse.json({ error: "Only the project owner can delete it" }, { status: 403 });
    }

    await db.project.delete({ where: { id: project.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/projects/[slug]", e);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
