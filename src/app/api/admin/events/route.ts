import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import type { AdminEventDTO } from "@/lib/types";
import { requireAdmin } from "../_guard";

export const dynamic = "force-dynamic";

function toDTO(e: {
  id: string;
  title: string;
  description: string;
  location: string | null;
  date: Date;
  createdAt: Date;
}): AdminEventDTO {
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    date: e.date.toISOString(),
    createdAt: e.createdAt.toISOString(),
  };
}

const eventFields = {
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(120, "Title must be 120 characters or fewer"),
  description: z
    .string()
    .trim()
    .min(3, "Description must be at least 3 characters")
    .max(1000, "Description must be 1000 characters or fewer"),
  location: z
    .string()
    .trim()
    .max(120, "Location must be 120 characters or fewer")
    .optional()
    .or(z.literal("")),
  date: z.coerce.date({ message: "Date must be a valid date" }),
};

// ---------- GET — every campus event, soonest first ----------

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const rows = await db.event.findMany({ orderBy: { date: "asc" } });

    return NextResponse.json({ events: rows.map(toDTO) });
  } catch (e) {
    console.error("GET /api/admin/events", e);
    return NextResponse.json({ error: "Failed to load events" }, { status: 500 });
  }
}

// ---------- POST — create an event ----------

const createSchema = z.object(eventFields);

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { title, description, location, date } = parsed.data;

    const created = await db.event.create({
      data: { title, description, location: location || null, date },
    });

    return NextResponse.json({ event: toDTO(created) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/events", e);
    return NextResponse.json({ error: "Failed to create the event" }, { status: 500 });
  }
}

// ---------- PATCH { id, ...fields } — edit an event ----------

const patchSchema = z
  .object({
    id: z.string().min(1),
    title: eventFields.title.optional(),
    description: eventFields.description.optional(),
    location: eventFields.location,
    date: z.coerce.date({ message: "Date must be a valid date" }).optional(),
  })
  .refine(
    (d) =>
      d.title !== undefined ||
      d.description !== undefined ||
      d.location !== undefined ||
      d.date !== undefined,
    { message: "Nothing to update" }
  );

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { id, title, description, location, date } = parsed.data;

    const existing = await db.event.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (location !== undefined) data.location = location || null;
    if (date !== undefined) data.date = date;

    const updated = await db.event.update({ where: { id }, data });

    return NextResponse.json({ event: toDTO(updated) });
  } catch (e) {
    console.error("PATCH /api/admin/events", e);
    return NextResponse.json({ error: "Failed to update the event" }, { status: 500 });
  }
}

// ---------- DELETE ?id= — remove an event ----------

export async function DELETE(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const id = req.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Missing event id" }, { status: 400 });
    }

    const existing = await db.event.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await db.event.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/events", e);
    return NextResponse.json({ error: "Failed to delete the event" }, { status: 500 });
  }
}
