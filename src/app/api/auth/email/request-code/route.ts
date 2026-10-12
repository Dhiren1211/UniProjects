import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isEducationEmail, EDU_EMAIL_HINT } from "@/lib/edu-email";
import { hashCode, sendVerificationEmail } from "@/lib/mailer";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(120),
});

const CODE_TTL_MIN = 10;
const RESEND_COOLDOWN_S = 60;

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

    // Education emails only — this is the registration gate.
    if (!isEducationEmail(email)) {
      return NextResponse.json({ error: EDU_EMAIL_HINT }, { status: 400 });
    }

    // Don't send codes for emails that already have an account.
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists — try signing in instead." },
        { status: 400 }
      );
    }

    // Cooldown between sends (anti-spam) — only pending codes count; a consumed
    // code means the email was verified, so re-requesting is fine immediately.
    const latest = await db.emailVerification.findFirst({
      where: { email, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (latest) {
      const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
      const wait = Math.ceil(RESEND_COOLDOWN_S - elapsed);
      if (wait > 0) {
        return NextResponse.json(
          { error: `Please wait ${wait}s before requesting a new code.`, cooldownSeconds: wait },
          { status: 429 }
        );
      }
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

    // A new request invalidates every earlier code/token for this email.
    await db.emailVerification.deleteMany({ where: { email } });
    await db.emailVerification.create({
      data: {
        email,
        codeHash: hashCode(email, code),
        expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60 * 1000),
      },
    });

    const mail = await sendVerificationEmail(email, code);
    return NextResponse.json({
      ok: true,
      expiresInMinutes: CODE_TTL_MIN,
      cooldownSeconds: RESEND_COOLDOWN_S,
      devCode: mail.devCode ?? null,
    });
  } catch (e) {
    console.error("POST /api/auth/email/request-code", e);
    return NextResponse.json({ error: "Could not send the code — try again" }, { status: 500 });
  }
}
