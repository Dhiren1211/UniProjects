import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/auth/forgot-password - PUBLIC password reset intake.
//
// The visitor submits their university email:
//   • every attempt is registered on the admin panel (PasswordResetRequest)
//   • when the email belongs to a registered account a fresh temporary
//     password is generated, stored, and emailed to that address
//   • the response is intentionally neutral either way, so the endpoint
//     cannot be used to discover who has an account
// ============================================================

const bodySchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(200),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Enter a valid email address" },
        { status: 400 }
      );
    }
    const email = parsed.data.email;

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, username: true, displayName: true, role: true },
    });

    if (user) {
      // Fresh credentials - the temp password replaces the old one immediately.
      const tempPassword = generateTemporaryPassword();
      await db.user.update({
        where: { id: user.id },
        data: { passwordHash: hashPassword(tempPassword) },
      });
      await sendPasswordResetEmail({
        to: email,
        name: user.displayName,
        loginId: user.username, // students sign in with their student number
        tempPassword,
      });
      await db.passwordResetRequest.create({
        data: { email, userId: user.id, status: "SENT" },
      });
    } else {
      // Still registered on the admin panel - flagged as unmatched.
      await db.passwordResetRequest.create({
        data: { email, status: "NOT_FOUND" },
      });
    }

    // Neutral on purpose - never reveal whether the address exists.
    return NextResponse.json({
      ok: true,
      message:
        "If that email is registered at UniProjects, a temporary password is on its way to your inbox.",
    });
  } catch (e) {
    console.error("POST /api/auth/forgot-password", e);
    // Even on a hard error keep the response neutral.
    return NextResponse.json(
      {
        ok: true,
        message:
          "If that email is registered at UniProjects, a temporary password is on its way to your inbox.",
      },
      { status: 200 }
    );
  }
}
