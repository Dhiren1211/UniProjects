import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { attachSession, createSession, hashPassword } from "@/lib/auth";

/**
 * Google OAuth 2.0 callback — exchanges the authorization code for a profile,
 * upserts the local user, and starts a session. Only reached when
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are configured.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const code = req.nextUrl.searchParams.get("code");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/?google=error`);
  }

  try {
    // 1. exchange the code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error(`token exchange failed (${tokenRes.status})`);
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) throw new Error("no access_token in Google response");

    // 2. fetch the verified profile
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!infoRes.ok) throw new Error(`userinfo failed (${infoRes.status})`);
    const info = (await infoRes.json()) as {
      email?: string;
      name?: string;
      picture?: string;
    };
    if (!info.email) throw new Error("Google profile has no verified email");

    // 3. find or create the local user
    const email = info.email.toLowerCase();
    const select = {
      department: { select: { id: true, name: true, code: true, accent: true } },
    };
    let user = await db.user.findUnique({ where: { email }, include: select });

    if (!user) {
      const raw = email.split("@")[0].replace(/[^a-z0-9._]/g, "");
      let base = raw.length >= 3 ? raw.slice(0, 30) : "google.user";
      let username = base;
      let n = 1;
      while (await db.user.findUnique({ where: { username } })) {
        username = `${base}${n}`.slice(0, 30);
        n += 1;
      }

      user = await db.user.create({
        data: {
          username,
          displayName: (info.name ?? raw ?? "Google User").slice(0, 60),
          email,
          // random secret — these users sign in with Google, not a password
          passwordHash: hashPassword(randomBytes(32).toString("hex")),
          avatarUrl: info.picture ?? null,
        },
        include: select,
      });
    }

    // 4. session + back to the app
    const token = await createSession(user.id);
    const res = NextResponse.redirect(`${origin}/`);
    attachSession(res, token);
    return res;
  } catch (e) {
    console.error("GET /api/auth/google/callback", e);
    return NextResponse.redirect(`${origin}/?google=error`);
  }
}
