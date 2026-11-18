import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  attachSession,
  createSession,
  DUMMY_PASSWORD_HASH,
  MAX_PASSWORD_LENGTH,
  toSafeUser,
  verifyPassword,
} from "@/lib/auth";
import { clientIp, rateLimit, resetRateLimit, sweepRateLimits } from "@/lib/rate-limit";

const schema = z.object({
  login: z.string().trim().min(1, "Enter your username or email").max(200),
  password: z.string().min(1, "Enter your password").max(MAX_PASSWORD_LENGTH),
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
    const { login, password } = parsed.data;
    const loginKey = `login:acct:${login.toLowerCase()}`;

    // Brute-force protection: 20 attempts / 15 min per IP, 8 failures / 15 min per account.
    sweepRateLimits();
    const [ipGate, acctGate] = await Promise.all([
      rateLimit(`login:ip:${clientIp(req)}`, 20, 15 * 60),
      db.rateLimit.findUnique({ where: { key: loginKey } }),
    ]);
    if (!ipGate.ok || (acctGate && acctGate.resetAt > new Date() && acctGate.count >= 8)) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Please wait 15 minutes and try again." },
        { status: 429 }
      );
    }

    const user = await db.user.findFirst({
      where: {
        OR: [{ username: login.toLowerCase() }, { email: login.toLowerCase() }],
      },
      include: {
        department: {
          select: { id: true, name: true, code: true, accent: true, capstoneLabel: true },
        },
      },
    });

    // Always run one scrypt comparison so response time doesn't reveal unknown usernames.
    const passwordOk = verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordOk) {
      await rateLimit(loginKey, 8, 15 * 60);
      return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
    }
    await resetRateLimit(loginKey);

    const token = await createSession(user.id);
    const res = NextResponse.json({ user: toSafeUser(user) });
    attachSession(res, token);
    return res;
  } catch (e) {
    console.error("POST /api/auth/login", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
