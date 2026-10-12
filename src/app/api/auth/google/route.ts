import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { attachSession, createSession, hashPassword } from "@/lib/auth";

/**
 * Google sign-in entry point.
 *
 * - When GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET are configured, this redirects to the
 *   real Google OAuth 2.0 consent screen (callback: /api/auth/google/callback).
 * - When they are NOT configured (sandbox / demo deployments), it signs the visitor in
 *   with a freshly created demo student account so the button still works end-to-end,
 *   then redirects back with ?google=demo so the UI can explain what happened.
 */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const origin = req.nextUrl.origin;

  if (clientId && clientSecret) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${origin}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
    });
    return NextResponse.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    );
  }

  // ----- demo fallback: sign into (or create) a demo student and start a session -----
  try {
    const demoNames = [
      "Minji Seo",
      "Hyunsik Kang",
      "Dayoung Lee",
      "Seungho Park",
      "Yerin Koo",
      "Jiho Yun",
    ];
    const name = demoNames[Math.floor(Math.random() * demoNames.length)];
    const base = `${name.split(" ")[0]}.${name.split(" ")[1]}`.toLowerCase();
    const username = `${base}.google`;
    const include = {
      department: { select: { id: true, name: true, code: true, accent: true } },
    };

    // reuse the demo account on repeat clicks instead of piling up users
    const user =
      (await db.user.findUnique({ where: { username }, include })) ??
      (await db.user.create({
        data: {
          username,
          displayName: name,
          email: `${username}@gmail.com`,
          // random secret — the demo account is reached via Google sign-in only
          passwordHash: hashPassword(randomBytes(32).toString("hex")),
          bio: "Joined the showcase with Google (demo account).",
        },
        include,
      }));

    const token = await createSession(user.id);
    const res = NextResponse.redirect(`${origin}/?google=demo`);
    attachSession(res, token);
    return res;
  } catch (e) {
    console.error("GET /api/auth/google (demo)", e);
    return NextResponse.redirect(`${origin}/?google=error`);
  }
}
