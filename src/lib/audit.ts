import { db } from "@/lib/db";

// ============================================================
// Activity log - records who did what, and when (Admin → Activity).
// Awaited by callers (serverless functions may stop right after responding)
// but it never throws: a logging failure must not break the action itself.
// ============================================================

export type AuditActor = { id: string; displayName: string; username?: string } | null | undefined;

export async function audit(
  actor: AuditActor,
  action: string,
  target: { type: string; id?: string | null; label: string },
  details?: string | null
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        actorName: actor ? `${actor.displayName}${actor.username ? ` (@${actor.username})` : ""}` : "System",
        action,
        targetType: target.type,
        targetId: target.id ?? null,
        targetLabel: target.label.slice(0, 200),
        details: details ? details.slice(0, 500) : null,
      },
    });
  } catch (e) {
    console.error("audit log failed:", action, e instanceof Error ? e.message : e);
  }
}
