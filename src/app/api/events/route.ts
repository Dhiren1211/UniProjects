import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { EventDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// ---------- GET — all campus events, soonest first ----------

export async function GET() {
  try {
    const rows = await db.event.findMany({ orderBy: { date: "asc" } });

    const events: EventDTO[] = rows.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      location: e.location,
      date: e.date.toISOString(),
    }));

    return NextResponse.json({ events });
  } catch (e) {
    console.error("GET /api/events", e);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}
