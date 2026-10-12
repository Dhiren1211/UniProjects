import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

// ---------- POST — request verification (owner / staff) ----------

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const project = await db.project.findUnique({ where: { slug } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (project.ownerId !== viewer.id && !isStaff(viewer.role)) {
      return NextResponse.json(
        { error: "Only the project owner can request verification" },
        { status: 403 }
      );
    }

    const pending = await db.verification.findFirst({
      where: { projectId: project.id, status: "PENDING" },
    });

    if (pending) {
      return NextResponse.json({ ok: true, status: "PENDING" });
    }

    await db.verification.create({
      data: { projectId: project.id, requesterId: viewer.id, status: "PENDING" },
    });

    return NextResponse.json({ ok: true, status: "PENDING" }, { status: 201 });
  } catch (e) {
    console.error("POST /api/projects/[slug]/verify", e);
    return NextResponse.json({ error: "Failed to request verification" }, { status: 500 });
  }
}
