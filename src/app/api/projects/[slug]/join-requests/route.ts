import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, isStaff } from "@/lib/auth";
import { notify } from "../../../_utils/notify";
import type { JoinRequestDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// ---------- GET — incoming join requests (owner / staff) ----------

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const project = await db.project.findUnique({ where: { slug } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (project.ownerId !== viewer.id && !isStaff(viewer.role)) {
      return NextResponse.json(
        { error: "Only the project owner can review join requests" },
        { status: 403 }
      );
    }

    const rows = await db.joinRequest.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
        user: { select: { id: true, username: true, displayName: true, role: true, avatarUrl: true } },
      },
    });

    const requests: JoinRequestDTO[] = rows.map((r) => ({
      id: r.id,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
    }));

    return NextResponse.json({ requests });
  } catch (e) {
    console.error("GET /api/projects/[slug]/join-requests", e);
    return NextResponse.json({ error: "Failed to load join requests" }, { status: 500 });
  }
}

// ---------- PATCH { requestId, decision } — approve / reject ----------

const patchSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const project = await db.project.findUnique({ where: { slug } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (project.ownerId !== viewer.id && !isStaff(viewer.role)) {
      return NextResponse.json(
        { error: "Only the project owner can review join requests" },
        { status: 403 }
      );
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { requestId, decision } = parsed.data;

    const joinRequest = await db.joinRequest.findUnique({ where: { id: requestId } });
    if (!joinRequest || joinRequest.projectId !== project.id) {
      return NextResponse.json({ error: "Join request not found" }, { status: 404 });
    }

    await db.joinRequest.update({ where: { id: joinRequest.id }, data: { status: decision } });

    if (decision === "APPROVED") {
      const existing = await db.projectMember.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: joinRequest.userId } },
      });
      if (!existing) {
        await db.projectMember.create({
          data: { projectId: project.id, userId: joinRequest.userId, role: "MEMBER" },
        });
      }
      notify(
        joinRequest.userId,
        "JOIN_APPROVED",
        `Your request to join ${project.title} was approved`,
        `/project/${project.slug}`
      );
    } else {
      notify(
        joinRequest.userId,
        "JOIN_REJECTED",
        `Your request to join ${project.title} was not approved`,
        `/project/${project.slug}`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/projects/[slug]/join-requests", e);
    return NextResponse.json({ error: "Failed to decide join request" }, { status: 500 });
  }
}
