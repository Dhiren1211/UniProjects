import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { NotificationDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// ---------- GET — the viewer's notifications, newest first, limit 50 ----------

export async function GET(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const [rows, unread] = await Promise.all([
      db.notification.findMany({
        where: { userId: viewer.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.notification.count({ where: { userId: viewer.id, read: false } }),
    ]);

    const notifications: NotificationDTO[] = rows.map((n) => ({
      id: n.id,
      type: n.type,
      body: n.body,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }));

    return NextResponse.json({ notifications, unread });
  } catch (e) {
    console.error("GET /api/notifications", e);
    return NextResponse.json({ error: "Failed to load notifications" }, { status: 500 });
  }
}

// ---------- PATCH { ids } | { all: true } — mark read ----------

const patchSchema = z
  .object({
    ids: z.array(z.string().min(1)).optional(),
    all: z.boolean().optional(),
  })
  .refine((d) => d.all || (d.ids && d.ids.length > 0), {
    message: "Provide ids or all",
  });

export async function PATCH(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { ids, all } = parsed.data;

    if (all) {
      await db.notification.updateMany({
        where: { userId: viewer.id, read: false },
        data: { read: true },
      });
    } else if (ids) {
      await db.notification.updateMany({
        where: { userId: viewer.id, id: { in: ids } },
        data: { read: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/notifications", e);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}
