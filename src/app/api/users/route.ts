import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getSessionUser,
  hashPassword,
  isStaff,
  SESSION_COOKIE,
  MAX_PASSWORD_LENGTH,
  toPublicUser,
  toSafeUser,
  verifyPassword,
} from "@/lib/auth";
import type { UserDirectoryEntry } from "@/lib/types";
import { isFromOurPages } from "@/lib/same-site";

export const dynamic = "force-dynamic";

const deptSelect = {
  id: true,
  name: true,
  code: true,
  accent: true,
  capstoneLabel: true,
} as const;

// ---------- GET - member directory ----------
//
// Who gets what:
//   staff               full directory (emails included)
//   signed-in members   search only (2+ characters, 10 results) - the teammate pickers
//   ?role=PROFESSOR     professor names only, for the public request form's picker,
//                       and only when asked by our own pages
//   anyone else         401

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const query = (sp.get("query") ?? sp.get("q") ?? "").trim();
    const dept = sp.get("dept")?.trim();
    const teammates = sp.get("teammates");
    const sort = sp.get("sort")?.trim();
    const role = sp.get("role")?.trim();

    const viewer = await getSessionUser(req);
    const staffViewer = isStaff(viewer?.role);

    if (!staffViewer && role === "PROFESSOR") {
      if (!isFromOurPages(req)) {
        return NextResponse.json({ error: "Not available" }, { status: 403 });
      }
      const profs = await db.user.findMany({
        where: { role: "PROFESSOR" },
        orderBy: { displayName: "asc" },
        take: 200,
        select: { id: true, displayName: true },
      });
      return NextResponse.json({ users: profs });
    }
    if (!viewer) {
      return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
    }
    if (!staffViewer && query.length < 2) {
      return NextResponse.json({ users: [] });
    }
    const take = staffViewer ? Math.min(Number(sp.get("pageSize")) || 60, 100) : 10;

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
    if (role && ["STUDENT", "PROFESSOR", "MODERATOR", "ADMIN"].includes(role)) {
      where.role = role;
    }
    // Administrator accounts are never listed for members (their usernames are sign-in names).
    if (!staffViewer) where.AND = [{ role: { not: "ADMIN" } }];

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

    // Emails and student numbers are only visible to staff.
    const serialize = staffViewer ? toSafeUser : toPublicUser;
    const users: UserDirectoryEntry[] = rows.map((u) => ({
      ...serialize(u),
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

// ---------- PATCH - update the viewer's own profile ----------

/** Only real web links - blocks javascript:, data: and other dangerous schemes. */
const httpUrl = (label: string) =>
  z
    .string()
    .trim()
    .max(300, `${label} is too long`)
    .refine((v) => /^https?:\/\/[^\s/$.?#][^\s]*$/i.test(v), {
      message: `${label} must be a full link starting with https://`,
    });

const patchSchema = z.object({
  displayName: z.string().trim().min(1, "Name cannot be empty").max(80).optional(),
  // nullable: the settings view sends null for empty optional fields to clear them
  bio: z.union([z.string().trim().max(600), z.literal("")]).nullable().optional(),
  program: z.union([z.string().trim().max(80), z.literal("")]).nullable().optional(),
  skills: z
    .union([z.array(z.string().trim().min(1).max(40)).max(30), z.string().trim().max(600)])
    .optional(),
  website: z.union([httpUrl("Website"), z.literal("")]).nullable().optional(),
  github: z.union([httpUrl("GitHub link"), z.literal("")]).nullable().optional(),
  // PROFESSOR only - link to the faculty member's official university profile page
  universityProfileUrl: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .max(300, "University profile URL is too long")
        .refine((v) => /^https?:\/\/\S+$/.test(v), {
          message: "Enter a full URL starting with http:// or https://",
        }),
    ])
    .optional()
    .nullable(),
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
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(MAX_PASSWORD_LENGTH, "Password is too long")
    .optional(),
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
    // The official faculty profile link is a professor-only field -
    // students/staff sending it are ignored rather than rejected.
    if (d.universityProfileUrl !== undefined && viewer.role === "PROFESSOR") {
      data.universityProfileUrl = d.universityProfileUrl || null;
    }
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

    // Password change - the current password is always verified first.
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

    // A password change signs out every other device.
    if (d.newPassword) {
      const current = req.cookies.get(SESSION_COOKIE)?.value;
      await db.session.deleteMany({
        where: { userId: viewer.id, ...(current ? { token: { not: current } } : {}) },
      });
    }

    return NextResponse.json({ user: toSafeUser(updated) });
  } catch (e) {
    console.error("PATCH /api/users", e);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
