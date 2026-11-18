import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/auth/forgot-password - PUBLIC password reset intake.
//
// SECURITY: this endpoint never changes a password. Previously it replaced
// the password immediately, which let anyone lock any account (including the
// only admin) just by knowing the email address - and with no real email
// provider the new password never reached the owner.
//
// Now a request is recorded as PENDING and the administrators are notified;
// an admin resets the password from Admin → Users and hands it over.
// The response is neutral either way, so the endpoint cannot be used to
// discover who has an account, and it is rate limited.
// ============================================================

const NEUTRAL = {
  ok: true,
  message:
    "If that email is registered at UniProjects, the capstone office has been notified and will send you a new password.",
};

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
});

export async function POST(req: NextRequest) {
  try {
    // 5 requests / hour per IP
    const gate = await rateLimit(`reset:ip:${clientIp(req)}`, 5, 60 * 60);
    if (!gate.ok) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Enter a valid email address" },
        { status: 400 }
      );
    }
    const email = parsed.data.email;

    // One logged request per address per hour - silently ignore repeats.
    const perEmail = await rateLimit(`reset:email:${email}`, 1, 60 * 60);
    if (!perEmail.ok) return NextResponse.json(NEUTRAL);

    const user = await db.user.findUnique({
      where: { email },
      select: { id: true, username: true, displayName: true },
    });

    await db.passwordResetRequest.create({
      data: { email, userId: user?.id ?? null, status: user ? "PENDING" : "NOT_FOUND" },
    });

    if (user) {
      const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      // awaited (not fire-and-forget) - serverless functions may stop after responding
      await db.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          type: "CREDENTIALS",
          body: `${user.displayName} (@${user.username}) asked for a password reset. Set a new password in Admin → Users.`,
          link: "/admin",
        })),
      });
    }

    return NextResponse.json(NEUTRAL);
  } catch (e) {
    console.error("POST /api/auth/forgot-password", e);
    return NextResponse.json(NEUTRAL, { status: 200 });
  }
}
