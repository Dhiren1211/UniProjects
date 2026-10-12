import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ---------- POST { title, date, note? } — add a timeline item (owner / staff) ----------

const addSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  date: z.coerce.date({ message: "Date must be a valid date" }),
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const project = await db.project.findUnique({ where: { slug } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (project.ownerId !== viewer.id && !isStaff(viewer.role)) {
      return NextResponse.json(
        { error: "Only the project owner can edit the timeline" },
        { status: 403 }
      );
    }

    const parsed = addSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const item = await db.projectTimeline.create({
      data: {
        projectId: project.id,
        title: parsed.data.title,
        date: parsed.data.date,
        note: parsed.data.note || null,
      },
    });

    return NextResponse.json(
      { item: { id: item.id, title: item.title, date: item.date.toISOString(), note: item.note } },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/projects/[slug]/timeline", e);
    return NextResponse.json({ error: "Failed to add timeline item" }, { status: 500 });
  }
}

// ---------- DELETE { itemId } — remove a timeline item (owner / staff) ----------

const deleteSchema = z.object({ itemId: z.string().min(1) });

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const project = await db.project.findUnique({ where: { slug } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (project.ownerId !== viewer.id && !isStaff(viewer.role)) {
      return NextResponse.json(
        { error: "Only the project owner can edit the timeline" },
        { status: 403 }
      );
    }

    const parsed = deleteSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const item = await db.projectTimeline.findUnique({ where: { id: parsed.data.itemId } });
    if (!item || item.projectId !== project.id) {
      return NextResponse.json({ error: "Timeline item not found" }, { status: 404 });
    }

    await db.projectTimeline.delete({ where: { id: item.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/projects/[slug]/timeline", e);
    return NextResponse.json({ error: "Failed to delete timeline item" }, { status: 500 });
  }
}
