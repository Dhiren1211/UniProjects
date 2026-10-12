import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { attachSession, createSession, toSafeUser, verifyPassword } from "@/lib/auth";

const schema = z.object({
  login: z.string().trim().min(1, "Enter your username or email"),
  password: z.string().min(1, "Enter your password"),
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

    const user = await db.user.findFirst({
      where: {
        OR: [{ username: login.toLowerCase() }, { email: login.toLowerCase() }],
      },
      include: { department: { select: { id: true, name: true, code: true, accent: true } } },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });
    }

    const token = await createSession(user.id);
    const res = NextResponse.json({ user: toSafeUser(user) });
    attachSession(res, token);
    return res;
  } catch (e) {
    console.error("POST /api/auth/login", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
