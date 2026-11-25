import { NextRequest, NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { sendSystemEmail } from "@/lib/mailer";
import { requireAdmin } from "../../_guard";

export const dynamic = "force-dynamic";

// POST /api/admin/mail-settings/send-test - send a test email to the signed-in admin.
export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.denied;
  try {
    const me = await db.user.findUnique({ where: { id: gate.viewer.id }, select: { email: true, displayName: true } });
    if (!me?.email) return NextResponse.json({ error: "Your account has no email address" }, { status: 400 });

    const result = await sendSystemEmail(
      me.email,
      "Capstone Contest test email",
      `Hello ${me.displayName},\n\nThis is a test message from Admin → Settings → Email delivery.\nIf you can read this, outgoing email works.\n\n- Capstone Contest`
    );
    await audit(gate.viewer, "settings.mailtest", { type: "SETTINGS", label: "email delivery" }, result.delivered ? `sent to ${me.email}` : "not delivered");
    return NextResponse.json({ delivered: result.delivered, to: me.email });
  } catch (e) {
    console.error("POST /api/admin/mail-settings/send-test", e);
    return NextResponse.json({ error: "Could not send the test email" }, { status: 500 });
  }
}
