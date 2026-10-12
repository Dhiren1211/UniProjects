import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionUser, isStaff, toSafeUser } from "@/lib/auth";
import { CATEGORIES, SEMESTERS } from "@/lib/config";
import type { ProjectListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// ---------- shapes ----------

const projectInclude = {
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

type ProjectRow = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

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

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export async function uniqueSlug(base: string) {
  let slug = base || "project";
  let i = 1;
  while (await db.project.findUnique({ where: { slug } })) {
    slug = `${base}-${++i}`;
  }
  return slug;
}

// ---------- GET /api/projects ----------

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim();
    const dept = sp.get("dept")?.trim();
    const category = sp.get("category")?.trim();
    const year = sp.get("year")?.trim();
    const tag = sp.get("tag")?.trim();
    const technology = sp.get("technology")?.trim();
    const featured = sp.get("featured");
    const verified = sp.get("verified");
    const teammates = sp.get("teammates");
    const owner = sp.get("owner")?.trim();
    const member = sp.get("member")?.trim(); // "me" or username
    const status = sp.get("status")?.trim(); // default: PUBLISHED (or MINE)
    const sort = sp.get("sort") ?? "newest";
    const take = Math.min(Number(sp.get("limit")) || 60, 100);

    const viewer = await getSessionUser(req);

    const where: Record<string, unknown> = {};

    if (status === "MINE" && viewer) {
      where.members = { some: { userId: viewer.id } };
    } else {
      where.status = "PUBLISHED";
    }
    if (owner) where.owner = { username: owner };
    if (member && member !== "me") where.members = { some: { user: { username: member } } };

    if (q) {
      where.OR = [
        { title: { contains: q } },
        { summary: { contains: q } },
        { description: { contains: q } },
        { tags: { contains: q } },
        { supervisor: { contains: q } },
      ];
    }
    if (dept) where.department = { code: dept };
    if (category) where.category = category;
    if (year && !Number.isNaN(Number(year))) where.year = Number(year);
    if (tag) where.tags = { contains: tag };
    if (technology) where.technologies = { some: { technology: { slug: technology } } };
    if (featured === "1") where.featured = true;
    if (verified === "1") where.verified = true;
    if (teammates === "1") where.lookingForTeammates = true;

    const orderBy =
      sort === "title"
        ? { title: "asc" as const }
        : sort === "popular"
          ? { views: "desc" as const }
          : { createdAt: "desc" as const };

    const rows = await db.project.findMany({
      where,
      orderBy: [orderBy],
      take,
      include: projectInclude,
    });

    const likeCounts = await db.like.groupBy({
      by: ["targetId"],
      where: { targetType: "PROJECT", targetId: { in: rows.map((r) => r.id) } },
      _count: { _all: true },
    });
    const likeMap = new Map(likeCounts.map((l) => [l.targetId, l._count._all]));

    return NextResponse.json({ projects: rows.map((r) => toListItem(r, likeMap.get(r.id) ?? 0)) });
  } catch (e) {
    console.error("GET /api/projects", e);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

// ---------- POST /api/projects ----------

const memberInput = z.object({
  username: z.string().trim().min(1),
  role: z.string().trim().min(2).max(40).default("MEMBER"),
});

/** Cover / gallery targets: uploaded paths, in-app image paths, or https links. */
const isImageTarget = (v: string) => /^(https?:\/\/|\/(uploads|covers|gallery)\/)\S+$/i.test(v);

const createSchema = z.object({
  title: z.string().trim().min(4, "Title must be at least 4 characters").max(120),
  summary: z.string().trim().min(20, "Summary must be at least 20 characters").max(220),
  description: z.string().trim().min(60, "Description must be at least 60 characters").max(6000),
  category: z.enum(CATEGORIES),
  year: z.coerce.number().int().min(2020).max(2030),
  semester: z.enum(SEMESTERS),
  dept: z.string().trim().min(1, "Department is required"),
  program: z.string().trim().max(80).optional().or(z.literal("")),
  supervisor: z.string().trim().max(80).optional().or(z.literal("")),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  demoUrl: z.string().trim().url("Demo link must be a valid URL").max(300).optional().or(z.literal("")),
  repoUrl: z.string().trim().url("Repository link must be a valid URL").max(300).optional().or(z.literal("")),
  publish: z.boolean().default(true),
  technologyIds: z.array(z.string()).max(20).default([]),
  coverImage: z
    .string()
    .trim()
    .min(1, "Add a cover image — every project needs one")
    .max(300)
    .refine(isImageTarget, "Cover must be an uploaded file, an in-app image path, or an https link"),
  galleryImages: z
    .array(
      z
        .string()
        .trim()
        .max(300)
        .refine(isImageTarget, "Gallery entries must be image links or uploads")
    )
    .max(8, "Up to 8 gallery images")
    .default([]),
  allowJoinRequests: z.boolean().default(true),
  lookingForTeammates: z.boolean().default(false),
  members: z.array(memberInput).max(10).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!viewer) {
      return NextResponse.json({ error: "Sign in to create a project" }, { status: 401 });
    }

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Please check the form" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const department = await db.department.findUnique({ where: { code: d.dept } });
    if (!department) {
      return NextResponse.json({ error: "Unknown department" }, { status: 400 });
    }

    // resolve teammate usernames (exclude self — the owner is implicit)
    const usernames = d.members.map((m) => m.username.toLowerCase()).filter((u) => u !== viewer.username);
    const users = usernames.length
      ? await db.user.findMany({ where: { username: { in: usernames } } })
      : [];
    if (users.length !== usernames.length) {
      return NextResponse.json({ error: "One of the tagged teammates was not found" }, { status: 400 });
    }

    const validTechs = d.technologyIds.length
      ? await db.technology.findMany({ where: { id: { in: d.technologyIds } } })
      : [];

    const project = await db.project.create({
      data: {
        slug: await uniqueSlug(slugify(d.title)),
        title: d.title,
        summary: d.summary,
        description: d.description,
        category: d.category,
        year: d.year,
        semester: d.semester,
        program: d.program || null,
        supervisor: d.supervisor || null,
        departmentId: department.id,
        ownerId: viewer.id,
        status: d.publish ? "PUBLISHED" : "DRAFT",
        allowJoinRequests: d.allowJoinRequests,
        lookingForTeammates: d.lookingForTeammates,
        tags: d.tags.map((t) => t.toLowerCase()).join(","),
        demoUrl: d.demoUrl || null,
        repoUrl: d.repoUrl || null,
        coverImage: d.coverImage,
        images: {
          create: [...new Set(d.galleryImages.map((u) => u.trim()).filter(Boolean))].map(
            (url, i) => ({ url, sortOrder: i })
          ),
        },
        members: {
          create: [
            { userId: viewer.id, role: "OWNER" },
            ...users.map((u) => ({
              userId: u.id,
              role: d.members.find((m) => m.username.toLowerCase() === u.username)?.role ?? "MEMBER",
            })),
          ],
        },
        technologies: {
          create: validTechs.map((t) => ({ technologyId: t.id })),
        },
      },
      include: projectInclude,
    });

    const likeCount = await db.like.count({
      where: { targetType: "PROJECT", targetId: project.id },
    });

    return NextResponse.json({ project: toListItem(project, likeCount) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/projects", e);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

// keep imports referenced
void toSafeUser;
void isStaff;
