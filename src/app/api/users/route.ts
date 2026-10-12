import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, hashPassword, toSafeUser, verifyPassword } from "@/lib/auth";
import type { UserDirectoryEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const deptSelect = { id: true, name: true, code: true, accent: true } as const;

// ---------- GET — student / member directory ----------

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const query = (sp.get("query") ?? sp.get("q") ?? "").trim();
    const dept = sp.get("dept")?.trim();
    const teammates = sp.get("teammates");
    const sort = sp.get("sort")?.trim();
    const take = Math.min(Number(sp.get("pageSize")) || 60, 100);

    const where: Record<string, unknown> = {};
    if (query) {
      where.OR = [
        { username: { contains: query } },
        { displayName: { contains: query } },
        { program: { contains: query } },
        { skills: { contains: query } },
      ];
    }
    if (dept) where.department = { code: dept };
    if (teammates === "1") where.lookingForTeammates = true;

    const rows = await db.user.findMany({
      where,
      orderBy: { displayName: "asc" },
      take,
      include: { department: { select: deptSelect } },
    });

    const counts = rows.length
      ? await db.projectMember.groupBy({
          by: ["userId"],
          where: { userId: { in: rows.map((r) => r.id) } },
          _count: { _all: true },
        })
      : [];
    const countMap = new Map(counts.map((c) => [c.userId, c._count._all]));

    const users: UserDirectoryEntry[] = rows.map((u) => ({
      ...toSafeUser(u),
      projectCount: countMap.get(u.id) ?? 0,
    }));

    if (sort === "projects") {
      users.sort(
        (a, b) => b.projectCount - a.projectCount || a.displayName.localeCompare(b.displayName)
      );
    } else if (sort === "name") {
      users.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }

    return NextResponse.json({ users });
  } catch (e) {
    console.error("GET /api/users", e);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

// ---------- PATCH — update the viewer's own profile ----------

const patchSchema = z.object({
  displayName: z.string().trim().min(1, "Name cannot be empty").max(80).optional(),
  // nullable: the settings view sends null for empty optional fields to clear them
  bio: z.union([z.string().trim().max(600), z.literal("")]).nullable().optional(),
  program: z.union([z.string().trim().max(80), z.literal("")]).nullable().optional(),
  skills: z
    .union([z.array(z.string().trim().min(1).max(40)).max(30), z.string().trim().max(600)])
    .optional(),
  website: z.union([z.string().trim().max(300), z.literal("")]).nullable().optional(),
  github: z.union([z.string().trim().max(300), z.literal("")]).nullable().optional(),
  // optional avatar: a root-relative path ("/avatars/…") or an https URL; "" clears it
  avatarUrl: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .max(500, "Avatar URL is too long")
        .refine((v) => v.startsWith("/") || v.startsWith("https://"), {
          message: "Avatar must start with / or https://",
        }),
    ])
    .optional()
    .nullable(),
  lookingForTeammates: z.boolean().optional(),
  dept: z.string().trim().max(20).optional(),
  // the settings view sends the full department DTO (or null to clear)
  department: z
    .union([
      z.null(),
      z.object({ id: z.string().trim().optional(), code: z.string().trim().optional() }),
    ])
    .optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, "New password must be at least 8 characters").optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    const data: Record<string, unknown> = {};
    if (d.displayName !== undefined) data.displayName = d.displayName;
    if (d.bio !== undefined) data.bio = d.bio || null;
    if (d.program !== undefined) data.program = d.program || null;
    if (d.skills !== undefined) {
      data.skills = Array.isArray(d.skills) ? d.skills.join(",") : d.skills || null;
    }
    if (d.website !== undefined) data.website = d.website || null;
    if (d.github !== undefined) data.github = d.github || null;
    if (d.avatarUrl !== undefined) data.avatarUrl = d.avatarUrl || null;
    if (d.lookingForTeammates !== undefined) data.lookingForTeammates = d.lookingForTeammates;
    if (d.dept !== undefined) {
      const department = await db.department.findUnique({ where: { code: d.dept } });
      if (!department) return NextResponse.json({ error: "Unknown department" }, { status: 400 });
      data.departmentId = department.id;
    }
    if (d.department !== undefined) {
      if (d.department === null) {
        data.departmentId = null;
      } else {
        // resolve by id first, fall back to the code (both are in the DTO)
        const department = (d.department.id
          ? await db.department.findUnique({ where: { id: d.department.id } })
          : null) ??
          (d.department.code
            ? await db.department.findUnique({ where: { code: d.department.code } })
            : null);
        if (!department) {
          return NextResponse.json({ error: "Unknown department" }, { status: 400 });
        }
        data.departmentId = department.id;
      }
    }

    // Password change — the current password is always verified first.
    if (d.newPassword) {
      if (!d.currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to change it" },
          { status: 400 }
        );
      }
      if (!verifyPassword(d.currentPassword, viewer.passwordHash)) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
      data.passwordHash = hashPassword(d.newPassword);
    }

    const updated = await db.user.update({
      where: { id: viewer.id },
      data,
      include: { department: { select: deptSelect } },
    });

    return NextResponse.json({ user: toSafeUser(updated) });
  } catch (e) {
    console.error("PATCH /api/users", e);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
