import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { canConfigureSite } from "@/lib/rbac";
import { getSettings, updateSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// ============================================================
// GET /api/settings - public (site behaviour + branding).
// PUT /api/settings - ADMIN only (admin panel Settings tab).
// ============================================================

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json({ settings });
  } catch (e) {
    console.error("GET /api/settings", e);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

const putSchema = z.object({
  searchEnabled: z.boolean().optional(),
  accountRequestsOpen: z.boolean().optional(),
  siteName: z.string().trim().min(2).max(60).optional(),
  heroTitle: z.string().trim().min(2).max(120).optional(),
  heroSubtitle: z.string().trim().max(300).optional(),
  heroImage: z
    .string()
    .trim()
    .max(300)
    .regex(/^(https?:\/\/|\/)\S+$/, "Use an https link or an in-app path")
    .optional(),
});

export async function PUT(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!canConfigureSite(viewer?.role)) {
      return NextResponse.json(
        { error: viewer ? "Only administrators can change site settings" : "Sign in to continue" },
        { status: viewer ? 403 : 401 }
      );
    }
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid settings" },
        { status: 400 }
      );
    }
    const settings = await updateSettings(parsed.data);
    return NextResponse.json({ settings });
  } catch (e) {
    console.error("PUT /api/settings", e);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
