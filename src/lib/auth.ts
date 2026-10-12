import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "up_session";
const SESSION_DAYS = 30;

// ---------- passwords ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === test.length && timingSafeEqual(expected, test);
}

// ---------- sessions ----------

export function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await db.session.create({
    data: { token, userId, expiresAt: sessionExpiry() },
  });
  return token;
}

export function attachSession(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSession(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export type SafeUser = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  bio: string | null;
  avatarUrl: string | null;
  program: string | null;
  skills: string[];
  website: string | null;
  github: string | null;
  lookingForTeammates: boolean;
  department: { id: string; name: string; code: string; accent: string } | null;
  createdAt: string;
};

export function toSafeUser(u: {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  bio: string | null;
  avatarUrl: string | null;
  program: string | null;
  skills: string | null;
  website: string | null;
  github: string | null;
  lookingForTeammates: boolean;
  createdAt: Date;
  department?: { id: string; name: string; code: string; accent: string } | null;
}): SafeUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    role: u.role,
    bio: u.bio,
    avatarUrl: u.avatarUrl,
    program: u.program,
    skills: u.skills ? u.skills.split(",").map((s) => s.trim()).filter(Boolean) : [],
    website: u.website,
    github: u.github,
    lookingForTeammates: u.lookingForTeammates,
    department: u.department ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

/** Resolve the signed-in user from the session cookie (null when guest). */
export async function getSessionUser(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          department: {
            select: { id: true, name: true, code: true, accent: true },
          },
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

/** Variant that takes a token string (used by auth/logout which only has the cookie). */
export async function deleteUserSession(token: string) {
  await db.session.deleteMany({ where: { token } }).catch(() => {});
}

export function isStaff(role: string | undefined | null) {
  return role === "FACULTY" || role === "ADMIN";
}
