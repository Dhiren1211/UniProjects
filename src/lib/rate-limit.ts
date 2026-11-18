import { NextRequest } from "next/server";
import { db } from "@/lib/db";

/** Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip). */
export function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Fixed-window counter. Returns { ok: false } once `limit` hits within
 * `windowSec` for this key. Fails open on database errors so a hiccup in the
 * limiter never locks everybody out.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<{ ok: boolean; retryAfterSec: number }> {
  try {
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowSec * 1000);
    const row = await db.rateLimit.findUnique({ where: { key } });
    if (!row || row.resetAt <= now) {
      await db.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      return { ok: true, retryAfterSec: 0 };
    }
    const updated = await db.rateLimit.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    const retryAfterSec = Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000));
    return { ok: updated.count <= limit, retryAfterSec };
  } catch (e) {
    console.error("rateLimit failed (allowing request):", e);
    return { ok: true, retryAfterSec: 0 };
  }
}

/** Clear a counter (e.g. after a successful login). */
export async function resetRateLimit(key: string): Promise<void> {
  await db.rateLimit.delete({ where: { key } }).catch(() => {});
}

/** Occasionally purge expired rows so the table stays small. */
export function sweepRateLimits(): void {
  if (Math.random() > 0.02) return;
  db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } }).catch(() => {});
}
