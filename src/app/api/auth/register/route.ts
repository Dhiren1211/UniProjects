import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { attachSession, createSession, hashPassword, toSafeUser } from "@/lib/auth";
import { isEducationEmail, EDU_EMAIL_HINT } from "@/lib/edu-email";

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(/^[a-z0-9._]+$/, "Username can only use lowercase letters, numbers, dots and underscores"),
  displayName: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().trim().email("Enter a valid email").max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(100),
  // Minted by /api/auth/email/verify-code after the 6-digit code is confirmed.
  verifyToken: z.string().min(16, "Verify your email before creating an account"),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { username, displayName, email: rawEmail, password, verifyToken } = parsed.data;
    const email = rawEmail.toLowerCase();

    // Education emails only — enforced again here (not just at request-code).
    if (!isEducationEmail(email)) {
      return NextResponse.json({ error: EDU_EMAIL_HINT }, { status: 400 });
    }

    const clash = await db.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { username: true, email: true },
    });
    if (clash) {
      return NextResponse.json(
        {
          error:
            clash.username === username
              ? "That username is already taken"
              : "An account with that email already exists",
        },
        { status: 400 }
      );
    }

    // The email must have been verified via the 6-digit code flow: a consumed
    // code row whose single-use token is still valid, bound to this exact email.
    const verification = await db.emailVerification.findFirst({
      where: {
        email,
        token: verifyToken,
        consumedAt: { not: null },
        tokenExpiresAt: { gt: new Date() },
      },
    });
    if (!verification) {
      return NextResponse.json(
        { error: "Please verify your email with the code we sent before creating your account." },
        { status: 400 }
      );
    }

    const user = await db.user.create({
      data: {
        username,
        displayName,
        email,
        passwordHash: hashPassword(password),
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
      include: { department: { select: { id: true, name: true, code: true, accent: true } } },
    });

    // Token is single-use.
    await db.emailVerification.delete({ where: { id: verification.id } });

    const token = await createSession(user.id);
    const res = NextResponse.json({ user: toSafeUser(user) }, { status: 201 });
    attachSession(res, token);
    return res;
  } catch (e) {
    console.error("POST /api/auth/register", e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
