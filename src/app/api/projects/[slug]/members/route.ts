import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, isStaff } from "@/lib/auth";
import { notify } from "../../../_utils/notify";

export const dynamic = "force-dynamic";

// ---------- POST { username, role } — add a member (owner / staff) ----------

const addSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  role: z.enum(["LEAD", "MEMBER"]).default("MEMBER"),
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
        { error: "Only the project owner can add members" },
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
    const { username, role } = parsed.data;

    const user = await db.user.findUnique({ where: { username: username.toLowerCase() } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const existing = await db.projectMember.findUnique({
      where: { projectId_userId: { projectId: project.id, userId: user.id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Already a member of this project" }, { status: 400 });
    }

    await db.projectMember.create({
      data: { projectId: project.id, userId: user.id, role },
    });

    notify(user.id, "SYSTEM", `You were added to ${project.title}`, `/project/${project.slug}`);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("POST /api/projects/[slug]/members", e);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}

// ---------- PATCH { memberId, role } — change role (owner / staff) ----------

const patchSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(["LEAD", "MEMBER"]),
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
        { error: "Only the project owner can manage members" },
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
    const { memberId, role } = parsed.data;

    const member = await db.projectMember.findUnique({ where: { id: memberId } });
    if (!member || member.projectId !== project.id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (member.role === "OWNER") {
      return NextResponse.json(
        { error: "The project owner's role cannot be changed" },
        { status: 400 }
      );
    }

    await db.projectMember.update({ where: { id: member.id }, data: { role } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/projects/[slug]/members", e);
    return NextResponse.json({ error: "Failed to update member" }, { status: 500 });
  }
}

// ---------- DELETE { memberId } | { self: true } ----------

const deleteSchema = z
  .object({
    memberId: z.string().min(1).optional(),
    self: z.boolean().optional(),
  })
  .refine((d) => d.memberId || d.self, { message: "Specify memberId or self" });

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const project = await db.project.findUnique({ where: { slug } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { memberId, self } = parsed.data;

    let member: { id: string; userId: string; role: string } | null = null;
    if (self) {
      member = await db.projectMember.findUnique({
        where: { projectId_userId: { projectId: project.id, userId: viewer.id } },
      });
    } else if (memberId) {
      const found = await db.projectMember.findUnique({ where: { id: memberId } });
      member = found && found.projectId === project.id ? found : null;
    }
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    if (member.role === "OWNER") {
      return NextResponse.json(
        { error: "The project owner cannot be removed" },
        { status: 400 }
      );
    }

    const canManage = project.ownerId === viewer.id || isStaff(viewer.role);
    if (member.userId !== viewer.id && !canManage) {
      return NextResponse.json(
        { error: "You can only remove yourself from this project" },
        { status: 403 }
      );
    }

    await db.projectMember.delete({ where: { id: member.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/projects/[slug]/members", e);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
