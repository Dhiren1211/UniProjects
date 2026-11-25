import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { clearMailSettings, getMailSettingsView, updateMailSettings } from "@/lib/admin-config";
import { requireAdmin } from "../_guard";

export const dynamic = "force-dynamic";

// ============================================================
// Email delivery (SMTP) settings - ADMIN only.
// GET     current values (the password is never returned, only whether one is set)
// PUT     save; omit `pass` to keep the stored one, "" removes it
// DELETE  forget the panel values - delivery falls back to the .env file
// ============================================================

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.denied;
  try {
    return NextResponse.json({ mail: await getMailSettingsView() });
  } catch (e) {
    console.error("GET /api/admin/mail-settings", e);
    return NextResponse.json({ error: "Failed to load the email settings" }, { status: 500 });
  }
}

const putSchema = z.object({
  host: z.string().trim().min(3, "Enter the SMTP host").max(200).regex(/^[a-zA-Z0-9.-]+$/, "Enter a host name like smtp.gmail.com"),
  port: z.coerce.number().int().min(1).max(65535),
  user: z.string().trim().min(3, "Enter the sending account").max(200),
  fromName: z.string().trim().min(1, "Enter a sender name").max(80),
  pass: z.string().max(200).optional(),
});

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.denied;
  try {
    const parsed = putSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid settings" }, { status: 400 });
    }
    const mail = await updateMailSettings(parsed.data);
    await audit(
      gate.viewer,
      "settings.update",
      { type: "SETTINGS", label: "Email delivery settings" },
      parsed.data.pass !== undefined ? "host, port, account, sender name, password" : "host, port, account, sender name"
    );
    return NextResponse.json({ mail });
  } catch (e) {
    console.error("PUT /api/admin/mail-settings", e);
    return NextResponse.json({ error: "Failed to save the email settings" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.denied;
  try {
    const mail = await clearMailSettings();
    await audit(gate.viewer, "settings.update", { type: "SETTINGS", label: "Email delivery settings" }, "reset to .env values");
    return NextResponse.json({ mail });
  } catch (e) {
    console.error("DELETE /api/admin/mail-settings", e);
    return NextResponse.json({ error: "Failed to reset the email settings" }, { status: 500 });
  }
}
