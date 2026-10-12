import { db } from "@/lib/db";

/**
 * Fire-and-forget notification. Never throws — a notification failure
 * must never break the main request flow.
 */
export function notify(
  userId: string | null | undefined,
  type: string,
  body: string,
  link?: string
) {
  if (!userId) return;
  db.notification
    .create({ data: { userId, type, body, link: link ?? null } })
    .catch((e) => console.error("notify:", type, e));
}
