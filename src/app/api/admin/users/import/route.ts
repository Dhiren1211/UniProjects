import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth";
import { deriveClassId, universityEmail } from "@/lib/rbac";
import { sendCredentialsEmail } from "@/lib/mailer";
import { resolveProfessorByName } from "../../../_utils/serialize";
import { requireAdmin } from "../../_guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// POST /api/admin/users/import - bulk-create STUDENT accounts (ADMIN).
// Body: { rows: ImportRow[] } - at most 50 per request (the client batches).
// Each student gets userID = student number, email a<id>@ks.ac.kr (unless
// given), a random password, and a credentials email. Existing accounts are
// skipped, never changed. Passwords are returned only when the email could
// not be delivered, so the admin can hand them over another way.
// ============================================================

const rowSchema = z.object({
  studentId: z.string().trim().regex(/^\d{6,10}$/, "Student ID must be 6–10 digits"),
  name: z.string().trim().min(2, "Name is required").max(80),
  // accepts I / II / III, 1 / 2 / 3, CD1 / CDII, "Capstone 2" …
  capstone: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => {
      const k = v.replace(/^(CAPSTONE|CD)\s*/, "");
      return ({ "1": "I", "2": "II", "3": "III" } as Record<string, string>)[k] ?? k;
    })
    .pipe(z.enum(["I", "II", "III"], { message: "Capstone must be I, II or III" }))
    .optional()
    .or(z.literal("").transform(() => undefined)),
  year: z.coerce.number().int().min(2020).max(2035).optional(),
  professor: z.string().trim().max(80).optional(),
  dept: z.string().trim().max(20).optional(),
  email: z.string().trim().toLowerCase().email().max(200).optional().or(z.literal("")),
  leader: z.boolean().optional(),
});

const bodySchema = z.object({ rows: z.array(z.unknown()).min(1).max(50) });

export type ImportResult = {
  row: number;
  studentId: string;
  name: string;
  status: "created" | "skipped" | "error";
  message?: string;
  emailed?: boolean;
  password?: string;
};

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Send between 1 and 50 rows at a time" }, { status: 400 });
    }

    const depts = await db.department.findMany({ select: { id: true, code: true } });
    const deptByCode = new Map(depts.map((d) => [d.code.toUpperCase(), d.id]));
    const results: ImportResult[] = [];

    for (let i = 0; i < parsed.data.rows.length; i++) {
      const raw = parsed.data.rows[i] as Record<string, unknown>;
      const r = rowSchema.safeParse(raw);
      const label = { row: Number(raw?.row) || i + 1, studentId: String(raw?.studentId ?? ""), name: String(raw?.name ?? "") };
      if (!r.success) {
        results.push({ ...label, status: "error", message: r.error.issues[0]?.message ?? "Invalid row" });
        continue;
      }
      const d = r.data;
      const email = d.email || universityEmail(d.studentId);

      const exists = await db.user.findFirst({
        where: { OR: [{ username: d.studentId }, { studentId: d.studentId }, { email }] },
        select: { id: true },
      });
      if (exists) {
        results.push({ ...label, status: "skipped", message: "Already has an account" });
        continue;
      }

      let departmentId: string | null = null;
      if (d.dept) {
        departmentId = deptByCode.get(d.dept.toUpperCase()) ?? null;
        if (!departmentId) {
          results.push({ ...label, status: "error", message: `Unknown department “${d.dept}”` });
          continue;
        }
      }

      const year = d.year ?? new Date().getFullYear();
      let classId: string | null = null;
      if (d.professor) {
        const prof = await resolveProfessorByName(d.professor);
        classId = prof?.classId ?? deriveClassId(d.capstone ?? "I", year, d.professor);
      }

      try {
        const password = generateTemporaryPassword(12);
        await db.user.create({
          data: {
            username: d.studentId,
            studentId: d.studentId,
            displayName: d.name,
            email,
            passwordHash: hashPassword(password),
            role: "STUDENT",
            classId,
            capstone: d.capstone ?? null,
            cohortYear: d.capstone || d.year ? year : null,
            professorName: d.professor || null,
            isTeamLeader: d.leader ?? false,
            departmentId,
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        });
        const mail = await sendCredentialsEmail({
          to: email,
          name: d.name,
          username: d.studentId,
          password,
          classId,
          professor: d.professor || null,
        });
        results.push({
          ...label,
          status: "created",
          emailed: mail.delivered,
          ...(mail.delivered ? {} : { password }),
        });
      } catch (e) {
        console.error("import row failed:", e instanceof Error ? e.message : e);
        results.push({ ...label, status: "error", message: "Could not create this account" });
      }
    }

    return NextResponse.json({ results });
  } catch (e) {
    console.error("POST /api/admin/users/import", e);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
