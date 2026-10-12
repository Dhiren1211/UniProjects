import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSessionUser, isStaff } from "@/lib/auth";
import { notify } from "../../_utils/notify";
import type { VerificationDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// ---------- GET — verification queue (staff only) ----------

export async function GET(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
    if (!isStaff(viewer.role)) {
      return NextResponse.json({ error: "Staff only" }, { status: 403 });
    }

    const rows = await db.verification.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        requester: { select: { id: true, username: true, displayName: true } },
        project: { select: { slug: true, title: true } },
      },
    });

    // PENDING first (newest first within each group)
    const pending = rows.filter((r) => r.status === "PENDING");
    const rest = rows.filter((r) => r.status !== "PENDING");

    const verifications: VerificationDTO[] = [...pending, ...rest].map((v) => ({
      id: v.id,
      projectId: v.projectId,
      status: v.status,
      createdAt: v.createdAt.toISOString(),
      requester: v.requester,
      project: v.project,
    }));

    return NextResponse.json({ verifications });
  } catch (e) {
    console.error("GET /api/moderation/verifications", e);
    return NextResponse.json({ error: "Failed to load verifications" }, { status: 500 });
  }
}

// ---------- PATCH { verificationId, decision } — approve / reject ----------

const patchSchema = z.object({
  verificationId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export async function PATCH(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
    if (!isStaff(viewer.role)) {
      return NextResponse.json({ error: "Staff only" }, { status: 403 });
    }

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { verificationId, decision } = parsed.data;

    const verification = await db.verification.findUnique({
      where: { id: verificationId },
      include: { project: { select: { id: true, slug: true, title: true } } },
    });
    if (!verification) {
      return NextResponse.json({ error: "Verification not found" }, { status: 404 });
    }

    await db.verification.update({
      where: { id: verification.id },
      data: { status: decision },
    });

    if (decision === "APPROVED") {
      await db.project.update({
        where: { id: verification.projectId },
        data: { verified: true },
      });
    }

    notify(
      verification.requesterId,
      "VERIFICATION",
      `Verification ${decision === "APPROVED" ? "approved" : "rejected"} for ${verification.project.title}`,
      `/project/${verification.project.slug}`
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/moderation/verifications", e);
    return NextResponse.json({ error: "Failed to decide verification" }, { status: 500 });
  }
}
