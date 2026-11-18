// ============================================================
// Mailer - transactional email with a persistent outbox.
// This sandbox has no SMTP credentials, so delivery currently
// "succeeds" by writing the formatted email to the server console
// (visible in dev.log) AND persisting it in the EmailLog table,
// which the admin panel surfaces as an "Email outbox".
// Swap deliver() for a real provider (SMTP/API) when one exists -
// everything else (formatting, outbox, admin UI) stays the same.
// ============================================================

import { db } from "@/lib/db";

export type MailResult = {
  /** true once a real provider is wired up; console+outbox delivery for now. */
  delivered: boolean;
  /** EmailLog row id, so callers can reference the outbox entry. */
  logId: string;
};

async function deliverAndLog(
  to: string,
  subject: string,
  body: string,
  kind: "CREDENTIALS" | "PASSWORD_RESET" | "SYSTEM"
): Promise<MailResult> {
  const lines = [
    "",
    "--------------------------------------------------------------",
    "  UniProjects - outgoing email",
    `  To:      ${to}`,
    `  Subject: ${subject}`,
    "",
    ...body.split("\n").map((l) => `  ${l}`),
    "--------------------------------------------------------------",
  ];
  // Never print the body in production - it contains passwords, and hosting
  // logs are not a safe place for them. The admin outbox (EmailLog) keeps a copy.
  if (process.env.NODE_ENV !== "production") console.log(lines.join("\n"));

  const log = await db.emailLog.create({
    data: { to, subject, body, kind, status: "CONSOLE" },
  });
  // delivered=false until an SMTP provider is configured (see header).
  return { delivered: false, logId: log.id };
}

/**
 * Welcome email with sign-in credentials.
 * - Students: approved account requests → class + professor lines.
 * - Staff (admin/moderator/professor): provisioned from the console → role line.
 */
export async function sendCredentialsEmail(opts: {
  to: string;
  name: string;
  username: string;
  password: string;
  roleLabel?: string;
  classId?: string | null;
  professor?: string | null;
}): Promise<MailResult> {
  const subject = "Your UniProjects account is ready";
  const section =
    opts.classId && opts.professor
      ? [`You have been placed in class ${opts.classId} under Professor ${opts.professor}.`]
      : opts.roleLabel
        ? [`Your account was created with the role: ${opts.roleLabel}.`]
        : [];
  const intro = opts.classId
    ? "Your account request has been approved. Here are your sign-in credentials:"
    : "Your account has been provisioned by an administrator. Here are your sign-in credentials:";
  const body = [
    `Hello ${opts.name},`,
    "",
    intro,
    "",
    `  User ID:  ${opts.username}`,
    `  Password: ${opts.password}`,
    "",
    ...section,
    "Please sign in and change your password from your profile settings.",
    "",
    "- UniProjects, Kyungsung University",
  ].join("\n");
  return deliverAndLog(opts.to, subject, body, "CREDENTIALS");
}

/**
 * Forgot-password - emails a fresh temporary password to a registered
 * university address. The public endpoint responds neutrally either way;
 * every attempt (matched or not) is logged for the admin "Resets" tab.
 */
export async function sendPasswordResetEmail(opts: {
  to: string;
  name: string;
  /** Login userID - the student number for students, username for staff. */
  loginId: string;
  tempPassword: string;
}): Promise<MailResult> {
  const subject = "Your UniProjects temporary password";
  const body = [
    `Hello ${opts.name},`,
    "",
    "We received a request to reset your UniProjects password. Here are your new sign-in credentials:",
    "",
    `  User ID:  ${opts.loginId}`,
    `  Password: ${opts.tempPassword}`,
    "",
    "Use them to sign in right away - this password replaces your old one.",
    "If you did not request this, you can safely ignore this email; your new password is already active.",
    "",
    "- UniProjects, Kyungsung University",
  ].join("\n");
  return deliverAndLog(opts.to, subject, body, "PASSWORD_RESET");
}

/** Generic notice (request rejected, announcement broadcast, …). */
export async function sendSystemEmail(to: string, subject: string, body: string): Promise<MailResult> {
  return deliverAndLog(to, subject, body, "SYSTEM");
}
