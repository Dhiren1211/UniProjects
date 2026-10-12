import { NextRequest, NextResponse } from "next/server";
import { clearSession, deleteUserSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await deleteUserSession(token);
  const res = NextResponse.json({ ok: true });
  clearSession(res);
  return res;
}
