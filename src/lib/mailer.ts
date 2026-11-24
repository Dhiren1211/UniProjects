// ============================================================
// Mailer - transactional email with a persistent outbox.
//
// Delivery uses SMTP when it is configured (env):
//   SMTP_USER   - the sending account, e.g. uniprojects.ks@gmail.com
//   SMTP_PASS   - its password (for Gmail: a 16-character App Password)
//   SMTP_HOST   - default smtp.gmail.com
//   SMTP_PORT   - default 465 (SSL)
//   MAIL_FROM_NAME - display name recipients see, default "UniProjects"
// Without SMTP_USER/SMTP_PASS mail is only stored in the EmailLog outbox
// (Admin → Emails), exactly as before. Every message is stored there either way.
// ============================================================

import nodemailer, { type Transporter } from "nodemailer";
import { db } from "@/lib/db";

export type MailResult = {
  /** true when the SMTP server accepted the message. */
  delivered: boolean;
  /** EmailLog row id, so callers can reference the outbox entry. */
  logId: string;
};

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, ""); // Gmail shows app passwords with spaces
  if (!user || !pass) return (transporter = null);
  const port = Number(process.env.SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Minimal, readable HTML version of the plain-text body. */
function toHtml(subject: string, body: string): string {
  const lines = escapeHtml(body)
    .split("\n")
    .map((l) =>
      /^\s{2}\S/.test(l)
        ? `<div style="font-family:ui-monospace,Consolas,monospace;background:#f3f5f8;padding:2px 10px;border-radius:6px;margin:2px 0">${l.trim()}</div>`
        : l
          ? `<p style="margin:0 0 10px">${l}</p>`
          : ""
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f6f7f9;padding:24px">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e8ec;border-radius:14px;padding:28px;font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.55;color:#10141d">
<p style="margin:0 0 18px;font-weight:600;font-size:17px">${escapeHtml(subject)}</p>${lines}</div></body></html>`;
}

async function deliverAndLog(
  to: string,
  subject: string,
  body: string,
  kind: "CREDENTIALS" | "PASSWORD_RESET" | "SYSTEM"
): Promise<MailResult> {
  const t = getTransporter();
  let status = "CONSOLE"; // stored only (no SMTP configured)

  if (t) {
    try {
      const fromName = (process.env.MAIL_FROM_NAME || "UniProjects").replace(/["<>]/g, "");
      await t.sendMail({
        from: `"${fromName}" <${process.env.SMTP_USER!.trim()}>`,
        to,
        subject,
        text: body,
        html: toHtml(subject, body),
      });
      status = "SENT";
    } catch (e) {
      status = "FAILED";
      console.error("Mail delivery failed:", kind, e instanceof Error ? e.message : e);
    }
  } else if (process.env.NODE_ENV !== "production") {
    // Dev only - the body may contain passwords, so it never goes to production logs.
    console.log(`
--- outgoing email (not sent: SMTP not configured) ---
To: ${to}
Subject: ${subject}

${body}
---`);
  }

  const log = await db.emailLog.create({ data: { to, subject, body, kind, status } });
  return { delivered: status === "SENT", logId: log.id };
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
  /** True when the account came from an approved account request. */
  approved?: boolean;
}): Promise<MailResult> {
  const subject = "Your UniProjects account is ready";
  const section =
    opts.classId && opts.professor
      ? [`You have been placed in class ${opts.classId} under Professor ${opts.professor}.`]
      : opts.roleLabel
        ? [
            `Your account was created with the role: ${opts.roleLabel}.`,
            ...(opts.classId ? [`Your teaching section is ${opts.classId}.`] : []),
          ]
        : [];
  const intro = opts.approved || opts.classId
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
 * Password reset by an administrator (after a forgot-password request or on
 * their own initiative) - sends the member their new sign-in details.
 */
export async function sendPasswordResetEmail(opts: {
  to: string;
  name: string;
  /** Login userID - the student number for students, username for staff. */
  loginId: string;
  tempPassword: string;
}): Promise<MailResult> {
  const subject = "Your UniProjects password was reset";
  const body = [
    `Hello ${opts.name},`,
    "",
    "An administrator has set a new password for your UniProjects account:",
    "",
    `  User ID:  ${opts.loginId}`,
    `  Password: ${opts.tempPassword}`,
    "",
    "Sign in and change it right away from Account settings.",
    "If you did not ask for this, contact the capstone office.",
    "",
    "- UniProjects, Kyungsung University",
  ].join("\n");
  return deliverAndLog(opts.to, subject, body, "PASSWORD_RESET");
}

/** Generic notice (request rejected, announcement broadcast, …). */
export async function sendSystemEmail(to: string, subject: string, body: string): Promise<MailResult> {
  return deliverAndLog(to, subject, body, "SYSTEM");
}
