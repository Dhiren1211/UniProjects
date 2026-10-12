import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { notify } from "../../../_utils/notify";

export const dynamic = "force-dynamic";

// ---------- POST { message? } — request to join ----------

const joinSchema = z.object({
  message: z.string().trim().max(500, "Message is too long").optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const project = await db.project.findUnique({ where: { slug } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (!project.allowJoinRequests) {
      return NextResponse.json(
        { error: "This project is not accepting join requests" },
        { status: 403 }
      );
    }

    const membership = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: viewer.id } },
    });
    if (membership) {
      return NextResponse.json(
        { error: "You are already a member of this project" },
        { status: 400 }
      );
    }

    const parsed = joinSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    await db.joinRequest.upsert({
      where: { projectId_userId: { projectId: project.id, userId: viewer.id } },
      create: {
        projectId: project.id,
        userId: viewer.id,
        message: parsed.data.message || null,
        status: "PENDING",
      },
      update: { status: "PENDING", message: parsed.data.message || null },
    });

    notify(
      project.ownerId,
      "JOIN_REQUEST",
      `${viewer.displayName} requested to join ${project.title}`,
      `/project/${project.slug}`
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("POST /api/projects/[slug]/join", e);
    return NextResponse.json({ error: "Failed to send join request" }, { status: 500 });
  }
}

// ---------- DELETE — cancel the viewer's pending request ----------

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const project = await db.project.findUnique({ where: { slug } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const deleted = await db.joinRequest.deleteMany({
      where: { projectId: project.id, userId: viewer.id },
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: "No join request to cancel" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/projects/[slug]/join", e);
    return NextResponse.json({ error: "Failed to cancel join request" }, { status: 500 });
  }
}
