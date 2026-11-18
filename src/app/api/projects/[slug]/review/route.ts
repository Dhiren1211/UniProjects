import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canReviewProject } from "../../../_utils/project-access";

export const dynamic = "force-dynamic";

// ============================================================
// POST /api/projects/[slug]/review - approve or send back a project.
// Only an admin or the project's own professor may decide.
//   APPROVE → PUBLISHED (visible to everyone). A professor's approval also
//             marks the project verified.
//   REJECT  → REJECTED with a note; the team edits and sends it again.
// ============================================================

const schema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE"), note: z.string().trim().max(1000).optional() }),
  z.object({
    decision: z.literal("REJECT"),
    note: z.string().trim().min(5, "Tell the team what to change (at least 5 characters)").max(1000),
  }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

    const project = await db.project.findUnique({
      where: { slug },
      include: { members: { where: { role: { in: ["OWNER", "LEAD"] } }, select: { userId: true } } },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    if (!canReviewProject(viewer, project)) {
      return NextResponse.json(
        { error: "Only this project's professor or an administrator can review it" },
        { status: 403 }
      );
    }

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const d = parsed.data;

    if (d.decision === "APPROVE" && project.status === "PUBLISHED") {
      return NextResponse.json({ error: "This project is already published" }, { status: 409 });
    }

    const byProfessor = viewer.role === "PROFESSOR";
    await db.project.update({
      where: { id: project.id },
      data:
        d.decision === "APPROVE"
          ? {
              status: "PUBLISHED",
              reviewNote: null,
              reviewedAt: new Date(),
              reviewedById: viewer.id,
              ...(byProfessor ? { verified: true } : {}),
            }
          : {
              status: "REJECTED",
              reviewNote: d.note,
              reviewedAt: new Date(),
              reviewedById: viewer.id,
            },
    });

    // A professor's approval also settles any open verification request.
    if (d.decision === "APPROVE" && byProfessor) {
      await db.verification.updateMany({
        where: { projectId: project.id, status: "PENDING" },
        data: { status: "APPROVED" },
      });
    }

    const recipients = [...new Set([project.ownerId, ...project.members.map((m) => m.userId)])].filter(
      (id): id is string => Boolean(id) && id !== viewer.id
    );
    if (recipients.length) {
      await db.notification.createMany({
        data: recipients.map((userId) => ({
          userId,
          type: "VERIFICATION",
          body:
            d.decision === "APPROVE"
              ? `${project.title} was approved and is now public.`
              : `${project.title} needs changes before it can be published: ${d.note}`,
          link: `/project/${project.slug}`,
        })),
      });
    }

    return NextResponse.json({ ok: true, status: d.decision === "APPROVE" ? "PUBLISHED" : "REJECTED" });
  } catch (e) {
    console.error("POST /api/projects/[slug]/review", e);
    return NextResponse.json({ error: "Could not save the review" }, { status: 500 });
  }
}
