import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateTemporaryPassword, getSessionUser, hashPassword } from "@/lib/auth";
import { canConfigureSite, deriveClassId, universityEmail } from "@/lib/rbac";
import { sendCredentialsEmail } from "@/lib/mailer";
import { resolveProfessorByName } from "../../_utils/serialize";
import { toRequestDTO } from "../route";

export const dynamic = "force-dynamic";

// ============================================================
// PATCH /api/account-requests/[id] - approve or reject (ADMIN only).
//
// Approving:
//   1. generates a userID (the student number) + a temporary password
//   2. provisions the STUDENT account (emailVerified, classId, section data)
//   3. sends the credentials to a<studentNumber>@ks.ac.kr (outbox + console)
//   4. returns everything the approval popup needs to display
//
// ClassID resolution: admin override → the named professor's registered
// teaching section (same professor ⇒ same classID) → deterministic
// CD<round>-<year>-<surname> fallback.
// ============================================================

const decideSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  /** Optional classID override - defaults to the deterministic derivation. */
  classId: z.string().trim().max(40).optional().or(z.literal("")),
  teamRole: z.enum(["LEADER", "MEMBER"]).default("MEMBER"),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

/** Audit label - "Name (studentId)" or "Name (email)" for professors. */
function requestLabel(r: { name: string; studentId: string | null; email: string | null }) {
  return `${r.name} (${r.studentId ?? r.email ?? "-"})`;
}

/** "Ji-woo Han" / "jiwoo.han" → "jiwoo.han" - Latin slug for usernames. */
function slugifyUsername(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 30);
}

const USERNAME_RE = /^[a-z0-9][a-z0-9._]{1,29}$/;

// Unambiguous alphabet kept in src/lib/auth.ts - generateTemporaryPassword().

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await getSessionUser(req);
    if (!canConfigureSite(viewer?.role)) {
      return NextResponse.json(
        { error: viewer ? "Only administrators can decide account requests" : "Sign in to continue" },
        { status: viewer ? 403 : 401 }
      );
    }

    const { id } = await ctx.params;
    const parsed = decideSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid decision" },
        { status: 400 }
      );
    }
    const { decision, classId: classIdOverride, teamRole, note } = parsed.data;

    const request = await db.accountRequest.findUnique({ where: { id } });
    if (!request) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (request.status !== "PENDING") {
      return NextResponse.json(
        { error: `This request was already ${request.status.toLowerCase()}` },
        { status: 409 }
      );
    }

    if (decision === "REJECTED") {
      const updated = await db.accountRequest.update({
        where: { id },
        data: {
          status: "REJECTED",
          decisionNote: note || null,
          decidedAt: new Date(),
          decidedBy: viewer!.displayName,
        },
      });
      await audit(viewer, "request.reject", { type: "REQUEST", id, label: requestLabel(request) }, note || null);
      return NextResponse.json({ request: toRequestDTO(updated) });
    }

    // ---------- APPROVE (professor) ----------
    // Professors sign in with a username taken from their email's local part;
    // their teaching section (classID) is optional and set by the admin.
    if (request.role === "PROFESSOR") {
      const email = request.email ?? "";
      let username = slugifyUsername(email.split("@")[0] ?? "");
      if (!USERNAME_RE.test(username)) username = slugifyUsername(request.name);
      if (!email || !USERNAME_RE.test(username)) {
        return NextResponse.json(
          { error: "Could not derive a username from this request - create the account manually in Members." },
          { status: 400 }
        );
      }
      const clash = await db.user.findFirst({
        where: { OR: [{ username }, { email }] },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: `User ID “${username}” or email ${email} is already taken - the professor may already have an account.` },
          { status: 409 }
        );
      }

      const profClassId = classIdOverride?.trim() || null;
      const temporaryPassword = generateTemporaryPassword();
      const user = await db.user.create({
        data: {
          username,
          displayName: request.name,
          email,
          passwordHash: hashPassword(temporaryPassword),
          role: "PROFESSOR",
          classId: profClassId,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
        select: { id: true, username: true, displayName: true, email: true },
      });

      const updated = await db.accountRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          classId: profClassId,
          decisionNote: note || null,
          decidedAt: new Date(),
          decidedBy: viewer!.displayName,
          createdUserId: user.id,
        },
      });

      const mail = await sendCredentialsEmail({
        to: email,
        name: user.displayName,
        username: user.username,
        password: temporaryPassword,
        roleLabel: "Professor",
        classId: profClassId,
        approved: true,
      });

      await audit(
        viewer,
        "request.approve",
        { type: "REQUEST", id, label: requestLabel(request) },
        `Professor account ${user.username}${profClassId ? `, class ${profClassId}` : ""}`
      );

      return NextResponse.json({
        request: toRequestDTO(updated),
        account: {
          userId: user.username,
          displayName: user.displayName,
          email: user.email,
          classId: profClassId ?? "",
          temporaryPassword,
        },
        emailLogId: mail.logId,
        emailed: mail.delivered,
      });
    }

    // ---------- APPROVE (student) ----------
    const studentId = request.studentId ?? "";
    const capstone = request.capstone ?? "I";
    const year = request.year ?? new Date().getFullYear();
    const professor = request.professor ?? "";
    // ClassID: explicit override wins; otherwise the student joins the
    // teaching section of the registered professor they picked; only when
    // no professor match exists does the deterministic derivation apply.
    let classId = classIdOverride?.trim() || "";
    if (!classId && professor) {
      const prof = await resolveProfessorByName(professor);
      if (prof?.classId) classId = prof.classId;
    }
    if (!classId) {
      classId = deriveClassId(capstone, year, professor);
    }
    const email = universityEmail(studentId);

    // The student number becomes the login userID - make sure it is free.
    const clash = await db.user.findFirst({
      where: { OR: [{ username: studentId }, { email }, { studentId }] },
      select: { id: true, username: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: `User ID “${studentId}” is already taken - the student may already have an account.` },
        { status: 409 }
      );
    }

    const temporaryPassword = generateTemporaryPassword();

    const user = await db.user.create({
      data: {
        username: studentId, // userID = student number
        displayName: request.name,
        email,
        passwordHash: hashPassword(temporaryPassword),
        role: "STUDENT",
        studentId,
        classId,
        capstone,
        cohortYear: year,
        professorName: professor || null,
        isTeamLeader: teamRole === "LEADER",
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      select: { id: true, username: true, displayName: true, email: true },
    });

    const updated = await db.accountRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        classId,
        decisionNote: note || null,
        decidedAt: new Date(),
        decidedBy: viewer!.displayName,
        createdUserId: user.id,
      },
    });

    // Notify the student at their university address (outbox + console).
    const mail = await sendCredentialsEmail({
      to: email,
      name: user.displayName,
      username: user.username,
      password: temporaryPassword,
      classId,
      professor,
      approved: true,
    });

    await audit(
      viewer,
      "request.approve",
      { type: "REQUEST", id, label: requestLabel(request) },
      `Account ${user.username}${classId ? `, class ${classId}` : ""}`
    );

    return NextResponse.json({
      request: toRequestDTO(updated),
      account: {
        userId: user.username,
        displayName: user.displayName,
        email: user.email,
        classId,
        temporaryPassword,
      },
      emailLogId: mail.logId,
      emailed: mail.delivered,
    });
  } catch (e) {
    console.error("PATCH /api/account-requests/[id]", e);
    return NextResponse.json({ error: "Failed to decide the request" }, { status: 500 });
  }
}

// DELETE - remove a request row (admin housekeeping, e.g. re-apply after rejection).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await getSessionUser(req);
    if (!canConfigureSite(viewer?.role)) {
      return NextResponse.json({ error: "Administrators only" }, { status: 403 });
    }
    const { id } = await ctx.params;
    const gone = await db.accountRequest.delete({ where: { id } }).catch(() => null);
    if (gone) await audit(viewer, "request.delete", { type: "REQUEST", id, label: requestLabel(gone) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/account-requests/[id]", e);
    return NextResponse.json({ error: "Failed to delete the request" }, { status: 500 });
  }
}
