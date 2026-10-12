import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import type { AdminProjectRow } from "@/lib/types";
import { likeCountMap, projectInclude, toListItem } from "../../_utils/serialize";
import { requireAdmin } from "../_guard";

export const dynamic = "force-dynamic";

// projectInclude (department/members/technologies) + the admin count columns
const listInclude = {
  ...projectInclude,
  _count: { select: { comments: true, resources: true } },
} satisfies Prisma.ProjectInclude;

type AdminProjectRowModel = Prisma.ProjectGetPayload<{ include: typeof listInclude }>;

/** toListItem + the admin-only columns (comment/resource counts, quality flags). */
function toAdminProjectRow(p: AdminProjectRowModel, likeCount: number): AdminProjectRow {
  return {
    ...toListItem(p, likeCount),
    commentCount: p._count.comments,
    resourceCount: p._count.resources,
    hasSourceLink: Boolean(p.repoUrl),
    hasCover: Boolean(p.coverImage),
  };
}

// ---------- GET ?query=&status=&dept= — every project, any status ----------

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const sp = req.nextUrl.searchParams;
    const query = (sp.get("query") ?? "").trim();
    const status = sp.get("status")?.trim();
    const dept = sp.get("dept")?.trim();

    const where: Record<string, unknown> = {};
    if (query) {
      where.OR = [{ title: { contains: query } }, { summary: { contains: query } }];
    }
    if (status === "DRAFT" || status === "PUBLISHED") {
      where.status = status;
    }
    if (dept) {
      where.department = { code: dept };
    }

    const rows = await db.project.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: listInclude,
    });

    const likeCounts = await likeCountMap(
      "PROJECT",
      rows.map((r) => r.id)
    );

    const projects = rows.map((p) => toAdminProjectRow(p, likeCounts.get(p.id) ?? 0));

    return NextResponse.json({ projects });
  } catch (e) {
    console.error("GET /api/admin/projects", e);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

// ---------- PATCH { id, featured?, status? } — feature / publish toggle ----------

const patchSchema = z
  .object({
    id: z.string().min(1),
    featured: z.boolean().optional(),
    status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  })
  .refine((d) => d.featured !== undefined || d.status !== undefined, {
    message: "Send featured or status to update",
  });

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
    const { id, featured, status } = parsed.data;

    const existing = await db.project.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const data: { featured?: boolean; status?: "DRAFT" | "PUBLISHED" } = {};
    if (featured !== undefined) data.featured = featured;
    if (status !== undefined) data.status = status;

    const updated = await db.project.update({
      where: { id },
      data,
      include: listInclude,
    });

    const likeCounts = await likeCountMap("PROJECT", [updated.id]);

    return NextResponse.json({ project: toAdminProjectRow(updated, likeCounts.get(updated.id) ?? 0) });
  } catch (e) {
    console.error("PATCH /api/admin/projects", e);
    return NextResponse.json({ error: "Failed to update the project" }, { status: 500 });
  }
}

// ---------- DELETE ?id= — remove a project (children cascade) ----------

export async function DELETE(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const id = req.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Missing project id" }, { status: 400 });
    }

    const existing = await db.project.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await db.project.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/projects", e);
    return NextResponse.json({ error: "Failed to delete the project" }, { status: 500 });
  }
}
