import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashCode } from "@/lib/mailer";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(120),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

const MAX_ATTEMPTS = 5;
const TOKEN_TTL_MIN = 20;

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const email = parsed.data.email.toLowerCase();
    const code = parsed.data.code;

    const row = await db.emailVerification.findFirst({
      where: { email },
      orderBy: { createdAt: "desc" },
    });
    if (!row || row.consumedAt) {
      return NextResponse.json(
        { error: "No active code for this email — request a new one." },
        { status: 400 }
      );
    }
    if (row.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "That code has expired — request a new one." },
        { status: 400 }
      );
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many wrong attempts — request a new code." },
        { status: 400 }
      );
    }

    if (row.codeHash !== hashCode(email, code)) {
      const attempts = row.attempts + 1;
      await db.emailVerification.update({ where: { id: row.id }, data: { attempts } });
      const left = MAX_ATTEMPTS - attempts;
      return NextResponse.json(
        {
          error:
            left > 0
              ? `That code isn't right — ${left} ${left === 1 ? "attempt" : "attempts"} left.`
              : "Too many wrong attempts — request a new code.",
        },
        { status: 400 }
      );
    }

    // Success: consume the code and mint a single-use token the register
    // endpoint will require. Wipe any other rows for this email first.
    const token = randomBytes(24).toString("hex");
    await db.emailVerification.deleteMany({ where: { email, id: { not: row.id } } });
    await db.emailVerification.update({
      where: { id: row.id },
      data: {
        consumedAt: new Date(),
        token,
        tokenExpiresAt: new Date(Date.now() + TOKEN_TTL_MIN * 60 * 1000),
      },
    });

    return NextResponse.json({ ok: true, verifyToken: token, expiresInMinutes: TOKEN_TTL_MIN });
  } catch (e) {
    console.error("POST /api/auth/email/verify-code", e);
    return NextResponse.json({ error: "Verification failed — try again" }, { status: 500 });
  }
}
