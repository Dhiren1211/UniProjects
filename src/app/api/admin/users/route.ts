import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ROLES, deriveClassId, roleLabel, universityEmail } from "@/lib/rbac";
import { sendCredentialsEmail, sendPasswordResetEmail } from "@/lib/mailer";
import { resolveProfessorByName } from "../../_utils/serialize";
import type { AdminUserRow } from "@/lib/types";
import { requireAdmin, requireStaff } from "../_guard";

export const dynamic = "force-dynamic";

const deptSelect = { id: true, name: true, code: true, accent: true, capstoneLabel: true } as const;

/** Mirrors toSafeUser (src/lib/auth.ts) + admin activity counts. */
function toAdminUserRow(
  u: {
    id: string;
    username: string;
    displayName: string;
    email: string;
    role: string;
    studentId: string | null;
    classId: string | null;
    capstone: string | null;
    cohortYear: number | null;
    professorName: string | null;
    isTeamLeader: boolean;
    bio: string | null;
    avatarUrl: string | null;
    program: string | null;
    skills: string | null;
    website: string | null;
    github: string | null;
    universityProfileUrl: string | null;
    lookingForTeammates: boolean;
    createdAt: Date;
    department?:
      | { id: string; name: string; code: string; accent: string; capstoneLabel: string }
      | null;
  },
  projectCount: number,
  classmateCount: number
): AdminUserRow {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    role: u.role,
    studentId: u.studentId,
    classId: u.classId,
    capstone: u.capstone,
    cohortYear: u.cohortYear,
    professorName: u.professorName,
    isTeamLeader: u.isTeamLeader,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    program: u.program,
    skills: u.skills ? u.skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
    website: u.website,
    github: u.github,
    universityProfileUrl: u.universityProfileUrl,
    lookingForTeammates: u.lookingForTeammates,
    department: u.department ?? null,
    createdAt: u.createdAt.toISOString(),
    projectCount,
    classmateCount,
  };
}

// ---------- GET ?query=&role= - directory of every member ----------

export async function GET(req: NextRequest) {
  try {
    const gate = await requireStaff(req);
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
        { studentId: { contains: query } },
        { classId: { contains: query } },
      ];
    }
    if (role && (ROLES as readonly string[]).includes(role)) {
      where.role = role;
    }

    const rows = await db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { department: { select: deptSelect } },
    });

    const ids = rows.map((r) => r.id);
    const memberCounts = ids.length
      ? await db.projectMember.groupBy({
          by: ["userId"],
          where: { userId: { in: ids } },
          _count: { _all: true },
        })
      : [];
    const memberMap = new Map(memberCounts.map((c) => [c.userId, c._count._all]));

    // classmateCount: how many users share each classId (section size).
    const classIds = [...new Set(rows.map((r) => r.classId).filter((c): c is string => Boolean(c)))];
    const classCounts = classIds.length
      ? await db.user.groupBy({ by: ["classId"], where: { classId: { in: classIds } }, _count: { _all: true } })
      : [];
    const classMap = new Map(classCounts.map((c) => [c.classId, c._count._all]));

    const users: AdminUserRow[] = rows.map((u) =>
      toAdminUserRow(
        u,
        memberMap.get(u.id) ?? 0,
        u.classId ? (classMap.get(u.classId) ?? 1) : 0
      )
    );

    return NextResponse.json({ users });
  } catch (e) {
    console.error("GET /api/admin/users", e);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}

// ---------- POST - create a member directly from the console ----------

const createSchema = z.object({
  displayName: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  /** Optional custom username; derived from studentId / email / name when omitted. */
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._]{1,29}$/, "Username must be 3–30 lowercase letters, numbers, dots or underscores")
    .optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  role: z.enum(ROLES).default("STUDENT"),
  dept: z.string().trim().max(20).optional(),
  program: z.string().trim().max(80).optional(),
  // Student section fields (requirement 6) - ignored for staff roles:
  studentId: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/, "Student ID must be 6–10 digits")
    .optional()
    .or(z.literal("")),
  classId: z.string().trim().max(40).optional().or(z.literal("")),
  capstone: z.enum(["I", "II", "III"]).optional(),
  cohortYear: z.coerce.number().int().min(2020).max(2035).optional(),
  professorName: z.string().trim().max(80).optional().or(z.literal("")),
  /** Team Leader or Member selection (requirement 6) - students only. */
  isTeamLeader: z.boolean().default(false),
});

/**
 * Latin slug for auto-derived usernames - "Ji-woo Han" → "ji.woo.han".
 * Non-Latin names (e.g. 김도현) produce "" and the caller falls back to
 * the email local-part or asks the admin for an explicit username.
 */
function slugifyUsername(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 30);
}

const USERNAME_RE = /^[a-z0-9][a-z0-9._]{1,29}$/;

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

    // Student section fields only apply to students (requirement 6) -
    // provisioning an admin/moderator/professor must never inherit them.
    const isStudent = d.role === "STUDENT";
    const isProfessor = d.role === "PROFESSOR";
    const studentId = isStudent && d.studentId ? d.studentId : null;
    const capstone = isStudent ? (d.capstone ?? null) : null;
    const cohortYear = isStudent ? (d.cohortYear ?? null) : null;
    const professorName = isStudent && d.professorName ? d.professorName : null;
    const isTeamLeader = isStudent ? d.isTeamLeader : false;

    // ClassID - students who name a registered professor are enrolled into
    // that professor's teaching section, so every student of the same
    // professor shares one classID (explicit admin value still wins).
    // Professors carry their own teaching section; other staff have none.
    let classId: string | null = null;
    if (isStudent) {
      if (d.classId) {
        classId = d.classId;
      } else if (professorName) {
        const prof = await resolveProfessorByName(professorName);
        if (prof?.classId) {
          classId = prof.classId;
        } else {
          classId = deriveClassId(capstone ?? "I", cohortYear ?? new Date().getFullYear(), professorName);
        }
      }
    } else if (isProfessor) {
      classId = d.classId || null;
    }

    // Identity derivation - username: explicit → student number → email
    // local-part → name slug. Email: explicit → a<studentId>@ks.ac.kr →
    // <username>@ks.ac.kr (university convention).
    let username = d.username || studentId || "";
    if (!username && d.email) {
      const local = slugifyUsername(d.email.split("@")[0]);
      if (USERNAME_RE.test(local)) username = local;
    }
    if (!username) {
      const slug = slugifyUsername(d.displayName);
      if (USERNAME_RE.test(slug)) username = slug;
    }
    if (!username) {
      return NextResponse.json(
        {
          error:
            "Could not derive a username - provide a username (3–30 lowercase letters, numbers, dots) or an email address",
        },
        { status: 400 }
      );
    }

    const email = d.email || (studentId ? universityEmail(studentId) : `${username}@ks.ac.kr`);

    // Friendly uniqueness errors before hitting the DB constraints.
    const [usernameTaken, emailTaken, studentIdTaken] = await Promise.all([
      db.user.findUnique({ where: { username }, select: { id: true } }),
      db.user.findUnique({ where: { email }, select: { id: true } }),
      studentId
        ? db.user.findUnique({ where: { studentId }, select: { id: true } })
        : Promise.resolve(null),
    ]);
    if (usernameTaken) {
      return NextResponse.json({ error: `Username “${username}” is already taken` }, { status: 409 });
    }
    if (emailTaken) {
      return NextResponse.json({ error: `Email “${email}” is already registered` }, { status: 409 });
    }
    if (studentIdTaken) {
      return NextResponse.json(
        { error: `Student ID “${studentId}” already has an account` },
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
        username,
        displayName: d.displayName,
        email,
        passwordHash: hashPassword(d.password),
        role: d.role,
        program: d.program || null,
        studentId,
        classId,
        capstone,
        cohortYear,
        professorName,
        isTeamLeader,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        ...(departmentId ? { departmentId } : {}),
      },
      include: { department: { select: deptSelect } },
    });

    await audit(gate.viewer, "user.create", {
      type: "USER",
      id: created.id,
      label: `${created.displayName} (@${created.username})`,
    }, roleLabel(d.role));

    // Credentials email - same outbox the approval flow uses, so every
    // provisioned account (student or staff) lands in the admin Emails tab.
    const mail = await sendCredentialsEmail({
      to: email,
      name: created.displayName,
      username: created.username,
      password: d.password,
      roleLabel: isStudent ? undefined : roleLabel(d.role),
      classId,
      professor: professorName,
    });

    return NextResponse.json(
      { user: toAdminUserRow(created, 0, 0), emailLogId: mail.logId },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/admin/users", e);
    return NextResponse.json({ error: "Failed to create the member" }, { status: 500 });
  }
}

// ---------- DELETE ?id= - remove a member (cascades their content) ----------

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
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
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
          { error: "This is the last admin - promote another admin before deleting it" },
          { status: 409 }
        );
      }
    }

    await db.user.delete({ where: { id } });
    await audit(viewer, "user.delete", { type: "USER", id, label: `${target.displayName} (@${target.username})` }, target.role);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/users", e);
    return NextResponse.json({ error: "Failed to delete the member" }, { status: 500 });
  }
}

// ---------- PATCH - edit a member from the console (ADMIN) ----------

const patchSchema = z.object({
  id: z.string().min(1),
  role: z.enum(ROLES).optional(),
  isTeamLeader: z.boolean().optional(),
  classId: z.string().trim().max(40).optional().or(z.literal("")),
  // PROFESSOR only - official university faculty profile link (admin-managed)
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
    .optional(),
  // ----- full profile editing (admin console "Edit member") -----
  displayName: z.string().trim().min(2, "Name must be at least 2 characters").max(80).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9._]{1,29}$/, "Username must be 3–30 lowercase letters, numbers, dots or underscores")
    .optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200).optional(),
  /** Optional password reset - blank/omitted keeps the current password. */
  password: z.string().min(8, "Password must be at least 8 characters").max(200).optional(),
  studentId: z
    .union([
      z.literal(""),
      z.string().trim().regex(/^\d{6,10}$/, "Student ID must be 6–10 digits"),
    ])
    .optional(),
  program: z.string().trim().max(80).optional(),
  /** Department code - "" clears the department. */
  dept: z.string().trim().max(20).optional(),
  capstone: z.union([z.literal(""), z.enum(["I", "II", "III"])]).optional(),
  cohortYear: z.union([z.literal(""), z.coerce.number().int().min(2020).max(2035)]).optional(),
  professorName: z.string().trim().max(80).optional().or(z.literal("")),
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
    const {
      id,
      role,
      isTeamLeader,
      classId,
      universityProfileUrl,
      displayName,
      username,
      email,
      password,
      studentId,
      program,
      dept,
      capstone,
      cohortYear,
      professorName,
    } = parsed.data;

    if (id === viewer.id && role && role !== "ADMIN") {
      return NextResponse.json({ error: "You cannot demote your own role" }, { status: 400 });
    }

    const existing = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true, username: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // The effective role AFTER this patch - university profile links and
    // section data follow the role the member is ending up with.
    const effectiveRole = role ?? existing.role;

    // The university faculty profile link belongs to professor accounts only.
    if (universityProfileUrl !== undefined && effectiveRole !== "PROFESSOR") {
      return NextResponse.json(
        { error: "University profile links belong to professor accounts" },
        { status: 400 }
      );
    }

    // Guard the last admin: demoting them would leave the console unreachable.
    if (role && existing.role === "ADMIN" && role !== "ADMIN") {
      const adminCount = await db.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "This is the last admin - promote another admin first" },
          { status: 409 }
        );
      }
    }

    // Friendly uniqueness errors (excluding this member) before the DB constraints.
    if (username !== undefined) {
      const taken = await db.user.findFirst({ where: { username, id: { not: id } }, select: { id: true } });
      if (taken) {
        return NextResponse.json({ error: `Username “${username}” is already taken` }, { status: 409 });
      }
    }
    if (email !== undefined) {
      const taken = await db.user.findFirst({ where: { email, id: { not: id } }, select: { id: true } });
      if (taken) {
        return NextResponse.json({ error: `Email “${email}” is already registered` }, { status: 409 });
      }
    }
    if (studentId) {
      const taken = await db.user.findFirst({ where: { studentId, id: { not: id } }, select: { id: true } });
      if (taken) {
        return NextResponse.json(
          { error: `Student ID “${studentId}” already has an account` },
          { status: 409 }
        );
      }
    }

    let departmentId: string | null | undefined;
    if (dept !== undefined) {
      if (dept === "") {
        departmentId = null;
      } else {
        const department = await db.department.findUnique({ where: { code: dept } });
        if (!department) {
          return NextResponse.json({ error: "Unknown department" }, { status: 400 });
        }
        departmentId = department.id;
      }
    }

    const updated = await db.user.update({
      where: { id },
      data: {
        ...(role ? { role } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
        ...(username !== undefined ? { username } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(password ? { passwordHash: hashPassword(password) } : {}),
        ...(program !== undefined ? { program: program || null } : {}),
        ...(studentId !== undefined ? { studentId: studentId || null } : {}),
        ...(capstone !== undefined ? { capstone: capstone || null } : {}),
        ...(cohortYear !== undefined ? { cohortYear: cohortYear === "" ? null : cohortYear } : {}),
        ...(professorName !== undefined ? { professorName: professorName || null } : {}),
        ...(isTeamLeader !== undefined ? { isTeamLeader } : {}),
        ...(classId !== undefined ? { classId: classId || null } : {}),
        ...(universityProfileUrl !== undefined
          ? { universityProfileUrl: universityProfileUrl || null }
          : {}),
        ...(departmentId !== undefined ? { departmentId } : {}),
        // Role moved out of STUDENT → strip student-only data. The classID
        // survives only on professors (it becomes their teaching section).
        ...(role && role !== existing.role && role !== "STUDENT"
          ? {
              studentId: null,
              capstone: null,
              cohortYear: null,
              professorName: null,
              isTeamLeader: false,
              ...(role !== "PROFESSOR" ? { classId: null } : {}),
            }
          : {}),
      },
      include: { department: { select: deptSelect } },
    });

    // New password set by the admin: sign the member out everywhere, email the
    // details, and close any open forgot-password requests for them.
    let emailLogId: string | undefined;
    if (password) {
      await db.session.deleteMany({ where: { userId: id } });
      const mail = await sendPasswordResetEmail({
        to: updated.email,
        name: updated.displayName,
        loginId: updated.username,
        tempPassword: password,
      });
      emailLogId = mail.logId;
      await db.passwordResetRequest.updateMany({
        where: { userId: id, status: "PENDING" },
        data: { status: "SENT" },
      });
    }

    const changed = Object.entries(parsed.data)
      .filter(([k, v]) => k !== "id" && k !== "password" && v !== undefined)
      .map(([k]) => (k === "role" && role && role !== existing.role ? `role ${existing.role} → ${role}` : k));
    if (password) changed.push("password reset");
    await audit(viewer, "user.update", { type: "USER", id, label: `${updated.displayName} (@${updated.username})` }, changed.join(", ") || null);

    const projectCount = await db.projectMember.count({ where: { userId: id } });

    return NextResponse.json({ user: toAdminUserRow(updated, projectCount, 0), emailLogId });
  } catch (e) {
    console.error("PATCH /api/admin/users", e);
    return NextResponse.json({ error: "Failed to update the member" }, { status: 500 });
  }
}
