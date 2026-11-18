import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { canAccessAdmin, universityEmail } from "@/lib/rbac";
import { getSessionUser } from "@/lib/auth";
import type { AccountRequestDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// ============================================================
// Account requests - students cannot self-register (requirement 3).
// POST   /api/account-requests   public intake (no email field - the
//                                university address is derived from the
//                                student number: a<studentNumber>@ks.ac.kr)
// GET    /api/account-requests   staff inbox (admin + moderator)
// ============================================================

const requestSchema = z.object({
  studentId: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/, "Student ID must be 6–10 digits"),
  name: z.string().trim().min(2, "Enter your full name").max(80),
  capstone: z.enum(["I", "II", "III"]),
  year: z.coerce.number().int().min(2020).max(2035),
  professor: z.string().trim().min(2, "Enter the professor's name").max(80),
});

export function toRequestDTO(r: {
  id: string;
  studentId: string;
  name: string;
  capstone: string;
  year: number;
  professor: string;
  status: string;
  decisionNote: string | null;
  classId: string | null;
  decidedAt: Date | null;
  decidedBy: string | null;
  createdAt: Date;
}): AccountRequestDTO {
  return {
    id: r.id,
    studentId: r.studentId,
    name: r.name,
    capstone: r.capstone,
    year: r.year,
    professor: r.professor,
    status: r.status as AccountRequestDTO["status"],
    decisionNote: r.decisionNote,
    classId: r.classId,
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
    decidedBy: r.decidedBy,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function POST(req: NextRequest) {
  try {
    const settings = await getSettings();
    if (!settings.accountRequestsOpen) {
      return NextResponse.json(
        { error: "Account requests are currently closed. Please contact the department office." },
        { status: 403 }
      );
    }

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Please check the form" },
        { status: 400 }
      );
    }
    const d = parsed.data;
    const studentId = d.studentId; // digits only - used verbatim as the userID

    // Already has an account (the student number IS the userID for students)?
    const existingUser = await db.user.findFirst({
      where: { OR: [{ username: studentId }, { studentId }, { email: universityEmail(studentId) }] },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account already exists for this student ID. Try signing in instead." },
        { status: 409 }
      );
    }

    // One request per student number (admin can delete rejected rows to allow a retry).
    const existing = await db.accountRequest.findUnique({ where: { studentId } });
    if (existing) {
      const msg =
        existing.status === "PENDING"
          ? "A request for this student ID is already awaiting review."
          : `A request for this student ID was already ${existing.status.toLowerCase()}. Contact the department office to re-apply.`;
      return NextResponse.json({ error: msg }, { status: 409 });
    }

    const created = await db.accountRequest.create({ data: d });

    return NextResponse.json(
      {
        request: toRequestDTO(created),
        universityEmail: universityEmail(studentId),
        message:
          "Request submitted. Once the coordinator approves it, your credentials will be sent to your university email.",
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/account-requests", e);
    return NextResponse.json({ error: "Failed to submit the request" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!canAccessAdmin(viewer?.role)) {
      return NextResponse.json({ error: "Staff only" }, { status: 403 });
    }
    const status = req.nextUrl.searchParams.get("status")?.trim();
    const rows = await db.accountRequest.findMany({
      where: status && status !== "ALL" ? { status } : undefined,
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    });
    return NextResponse.json({ requests: rows.map(toRequestDTO) });
  } catch (e) {
    console.error("GET /api/account-requests", e);
    return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
  }
}
