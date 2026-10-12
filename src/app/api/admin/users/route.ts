import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import type { AdminUserRow } from "@/lib/types";
import { requireAdmin } from "../_guard";

export const dynamic = "force-dynamic";

const deptSelect = { id: true, name: true, code: true, accent: true } as const;

/** Mirrors toSafeUser (src/lib/auth.ts) + the admin activity counts. Local copy — auth.ts stays untouched. */
function toAdminUserRow(
  u: {
    id: string;
    username: string;
    displayName: string;
    email: string;
    role: string;
    bio: string | null;
    avatarUrl: string | null;
    program: string | null;
    skills: string | null;
    website: string | null;
    github: string | null;
    lookingForTeammates: boolean;
    createdAt: Date;
    department?: { id: string; name: string; code: string; accent: string } | null;
  },
  projectCount: number,
  postCount: number
): AdminUserRow {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    role: u.role,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    program: u.program,
    skills: u.skills ? u.skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
    website: u.website,
    github: u.github,
    lookingForTeammates: u.lookingForTeammates,
    department: u.department ?? null,
    createdAt: u.createdAt.toISOString(),
    projectCount,
    postCount,
  };
}

// ---------- GET ?query=&role= — directory of every member ----------

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const sp = req.nextUrl.searchParams;
    const query = (sp.get("query") ?? "").trim();
    const role = sp.get("role")?.trim();

    const where: Record<string, unknown> = {};
    if (query) {
      where.OR = [
        { username: { contains: query } },
        { displayName: { contains: query } },
        { email: { contains: query } },
      ];
    }
    if (role === "STUDENT" || role === "FACULTY" || role === "ADMIN") {
      where.role = role;
    }

    const rows = await db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { department: { select: deptSelect } },
    });

    const ids = rows.map((r) => r.id);
    const [memberCounts, postCounts] = await Promise.all([
      ids.length
        ? db.projectMember.groupBy({
            by: ["userId"],
            where: { userId: { in: ids } },
            _count: { _all: true },
          })
        : Promise.resolve([] as { userId: string; _count: { _all: number } }[]),
      ids.length
        ? db.post.groupBy({
            by: ["userId"],
            where: { userId: { in: ids } },
            _count: { _all: true },
          })
        : Promise.resolve([] as { userId: string; _count: { _all: number } }[]),
    ]);
    const memberMap = new Map(memberCounts.map((c) => [c.userId, c._count._all]));
    const postMap = new Map(postCounts.map((c) => [c.userId, c._count._all]));

    const users: AdminUserRow[] = rows.map((u) =>
      toAdminUserRow(u, memberMap.get(u.id) ?? 0, postMap.get(u.id) ?? 0)
    );

    return NextResponse.json({ users });
  } catch (e) {
    console.error("GET /api/admin/users", e);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

// ---------- POST — create a member directly from the console ----------

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,28})[a-z0-9]$/;

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_RE, "Username must be 3–30 lowercase letters, numbers, dots or underscores"),
  displayName: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.enum(["STUDENT", "FACULTY", "ADMIN"]).default("STUDENT"),
  dept: z.string().trim().max(20).optional(),
  program: z.string().trim().max(80).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const d = parsed.data;

    // Friendly uniqueness errors before hitting the DB constraints.
    const [usernameTaken, emailTaken] = await Promise.all([
      db.user.findUnique({ where: { username: d.username }, select: { id: true } }),
      db.user.findUnique({ where: { email: d.email }, select: { id: true } }),
    ]);
    if (usernameTaken) {
      return NextResponse.json(
        { error: `Username “${d.username}” is already taken` },
        { status: 409 }
      );
    }
    if (emailTaken) {
      return NextResponse.json(
        { error: `Email “${d.email}” is already registered` },
        { status: 409 }
      );
    }

    let departmentId: string | undefined;
    if (d.dept) {
      const department = await db.department.findUnique({ where: { code: d.dept } });
      if (!department) {
        return NextResponse.json({ error: "Unknown department" }, { status: 400 });
      }
      departmentId = department.id;
    }

    const created = await db.user.create({
      data: {
        username: d.username,
        displayName: d.displayName,
        email: d.email,
        passwordHash: hashPassword(d.password),
        role: d.role,
        program: d.program || null,
        ...(departmentId ? { departmentId } : {}),
      },
      include: { department: { select: deptSelect } },
    });

    return NextResponse.json(
      { user: toAdminUserRow(created, 0, 0) },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/admin/users", e);
    return NextResponse.json({ error: "Failed to create the member" }, { status: 500 });
  }
}

// ---------- DELETE ?id= — remove a member (cascades their content) ----------

export async function DELETE(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;
    const viewer = gate.viewer;

    const id = req.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }
    if (id === viewer.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, username: true, displayName: true, role: true },
    });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (target.role === "ADMIN") {
      const adminCount = await db.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "This is the last admin — promote another admin before deleting it" },
          { status: 409 }
        );
      }
    }

    await db.user.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/users", e);
    return NextResponse.json({ error: "Failed to delete the member" }, { status: 500 });
  }
}

// ---------- PATCH { id, role } — change a member's role ----------

const patchSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["STUDENT", "FACULTY", "ADMIN"]),
});

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;
    const viewer = gate.viewer;

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { id, role } = parsed.data;

    if (id === viewer.id) {
      return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
    }

    const existing = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Guard the last admin: demoting them would leave the console unreachable.
    if (existing.role === "ADMIN" && role !== "ADMIN") {
      const adminCount = await db.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "This is the last admin — promote another admin first" },
          { status: 409 }
        );
      }
    }

    const updated = await db.user.update({
      where: { id },
      data: { role },
      include: { department: { select: deptSelect } },
    });

    const [projectCount, postCount] = await Promise.all([
      db.projectMember.count({ where: { userId: id } }),
      db.post.count({ where: { userId: id } }),
    ]);

    return NextResponse.json({ user: toAdminUserRow(updated, projectCount, postCount) });
  } catch (e) {
    console.error("PATCH /api/admin/users", e);
    return NextResponse.json({ error: "Failed to update the role" }, { status: 500 });
  }
}
