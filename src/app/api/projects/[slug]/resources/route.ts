import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, isStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

const RESOURCE_TYPES = ["DEMO", "GITHUB", "DOCUMENT", "VIDEO", "PRESENTATION"] as const;

/** http(s) links and uploaded files (/uploads/…) are both valid. */
const isResourceTarget = (v: string) =>
  /^https?:\/\/\S+$/i.test(v) || /^\/uploads\/[a-z0-9/-]+\.[a-z0-9]{1,8}$/i.test(v);

// ---------- POST { type, label, url } — add a resource (owner / staff) ----------

const addSchema = z.object({
  type: z.enum(RESOURCE_TYPES),
  label: z.string().trim().min(1, "Label is required").max(80),
  url: z
    .string()
    .trim()
    .min(1, "Add a link or upload a file first")
    .max(300)
    .refine(isResourceTarget, "Enter a full http(s):// link or upload a file"),
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
        { error: "Only the project owner can add resources" },
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

    const resource = await db.projectResource.create({
      data: {
        projectId: project.id,
        type: parsed.data.type,
        label: parsed.data.label,
        url: parsed.data.url,
      },
    });

    return NextResponse.json({ resource }, { status: 201 });
  } catch (e) {
    console.error("POST /api/projects/[slug]/resources", e);
    return NextResponse.json({ error: "Failed to add resource" }, { status: 500 });
  }
}

// ---------- DELETE { resourceId } — remove a resource (owner / staff) ----------

const deleteSchema = z.object({ resourceId: z.string().min(1) });

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const project = await db.project.findUnique({ where: { slug } });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (project.ownerId !== viewer.id && !isStaff(viewer.role)) {
      return NextResponse.json(
        { error: "Only the project owner can remove resources" },
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

    const resource = await db.projectResource.findUnique({ where: { id: parsed.data.resourceId } });
    if (!resource || resource.projectId !== project.id) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    await db.projectResource.delete({ where: { id: resource.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/projects/[slug]/resources", e);
    return NextResponse.json({ error: "Failed to delete resource" }, { status: 500 });
  }
}
