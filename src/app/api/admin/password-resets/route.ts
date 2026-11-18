import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/mailer";
import type { PasswordResetRow } from "@/lib/types";
import { requireAdmin } from "../_guard";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/admin/password-resets - forgot-password audit log (ADMIN).
// Every public "forgot password" attempt lands here: the address that
// was asked for, whether it matched an account, and when.
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const sp = req.nextUrl.searchParams;
    const status = sp.get("status")?.trim(); // PENDING | SENT | DISMISSED | NOT_FOUND
    const q = (sp.get("q") ?? "").trim().toLowerCase().slice(0, 100);
    // match the typed address, or the matched member's username / name
    const matchedIds = q
      ? (
          await db.user.findMany({
            where: {
              OR: [
                { username: { contains: q, mode: "insensitive" } },
                { displayName: { contains: q, mode: "insensitive" } },
              ],
            },
            select: { id: true },
            take: 200,
          })
        ).map((u) => u.id)
      : [];
    const rows = await db.passwordResetRequest.findMany({
      where: {
        ...(status && status !== "ALL" ? { status } : {}),
        ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { userId: { in: matchedIds } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    // Resolve the matched accounts in one query for the admin table.
    const userIds = [...new Set(rows.map((r) => r.userId).filter((v): v is string => Boolean(v)))];
    const users = userIds.length
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, displayName: true, role: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const resets: PasswordResetRow[] = rows.map((r) => ({
      id: r.id,
      email: r.email,
      status: r.status as PasswordResetRow["status"],
      createdAt: r.createdAt.toISOString(),
      user: r.userId ? (userMap.get(r.userId) ?? null) : null,
    }));

    return NextResponse.json({ resets });
  } catch (e) {
    console.error("GET /api/admin/password-resets", e);
    return NextResponse.json({ error: "Failed to load password reset requests" }, { status: 500 });
  }
}

// ============================================================
// POST /api/admin/password-resets - one-click reset (ADMIN).
//   { userId } or { requestId }  → new temporary password, saved, user signed
//   out everywhere, emailed, and the member's pending requests marked SENT.
//   The password is returned to the admin only when the email could not be
//   delivered, so they can hand it over another way.
// PATCH { requestId, status: "DISMISSED" } - close a request without resetting.
// ============================================================

const postSchema = z
  .object({ userId: z.string().min(1).optional(), requestId: z.string().min(1).optional() })
  .refine((v) => v.userId || v.requestId, "Choose a member or a request");

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }

    let userId = parsed.data.userId;
    if (!userId && parsed.data.requestId) {
      const request = await db.passwordResetRequest.findUnique({ where: { id: parsed.data.requestId } });
      if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
      if (!request.userId) {
        return NextResponse.json({ error: "This request doesn't match any account" }, { status: 400 });
      }
      userId = request.userId;
    }

    const user = await db.user.findUnique({
      where: { id: userId! },
      select: { id: true, email: true, username: true, displayName: true },
    });
    if (!user) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const tempPassword = generateTemporaryPassword(12);
    await db.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(tempPassword) } });
    await db.session.deleteMany({ where: { userId: user.id } });

    const mail = await sendPasswordResetEmail({
      to: user.email,
      name: user.displayName,
      loginId: user.username,
      tempPassword,
    });

    await db.passwordResetRequest.updateMany({
      where: { userId: user.id, status: "PENDING" },
      data: { status: "SENT" },
    });

    return NextResponse.json({
      ok: true,
      delivered: mail.delivered,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      emailLogId: mail.logId,
      ...(mail.delivered ? {} : { tempPassword }),
    });
  } catch (e) {
    console.error("POST /api/admin/password-resets", e);
    return NextResponse.json({ error: "Could not reset the password" }, { status: 500 });
  }
}

const patchSchema = z.object({ requestId: z.string().min(1), status: z.literal("DISMISSED") });

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    const updated = await db.passwordResetRequest.updateMany({
      where: { id: parsed.data.requestId },
      data: { status: "DISMISSED" },
    });
    if (updated.count === 0) return NextResponse.json({ error: "Request not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/admin/password-resets", e);
    return NextResponse.json({ error: "Could not update the request" }, { status: 500 });
  }
}
