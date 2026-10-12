// ============================================================
// Mailer — verification-code delivery.
// This sandbox has no SMTP/provider credentials, so delivery
// currently "succeeds" by writing a formatted email to the server
// console (visible in dev.log) and, outside production, echoing
// the code back so the UI can offer a demo shortcut. Swap the body
// of sendVerificationEmail for a real provider when one exists.
// ============================================================

import { createHash } from "crypto";

const PEPPER = process.env.MAIL_PEPPER ?? "uniproject-dev-pepper";

/** The plain code is never stored — only this hash is compared. */
export function hashCode(email: string, code: string): string {
  return createHash("sha256")
    .update(`${email.trim().toLowerCase()}:${code.trim()}:${PEPPER}`)
    .digest("hex");
}

export type MailResult = {
  /** true once a real provider is wired up; console-log delivery for now. */
  delivered: boolean;
  /** Present only outside production so the demo UI can show the code. */
  devCode?: string;
};

export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<MailResult> {
  const lines = [
    "",
    "--------------------------------------------------------------",
    "  UniProjects — email verification",
    `  To:      ${email}`,
    `  Code:    ${code}`,
    "  Subject: Your UniProjects verification code",
    `  Body:    Your verification code is ${code}. It expires in 10 minutes.`,
    "--------------------------------------------------------------",
  ];
  console.log(lines.join("\n"));

  if (process.env.NODE_ENV !== "production") {
    return { delivered: false, devCode: code };
  }
  return { delivered: false };
}
