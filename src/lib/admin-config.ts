// ============================================================
// Private, admin-only configuration stored in the Setting table.
//
// Unlike src/lib/settings.ts (public site settings served by GET
// /api/settings), nothing here is ever sent to visitors:
//   - storage.capacityMb    database plan size, for the Storage tab
//   - images.*              upload compression options
//   - mail.*                SMTP delivery (overrides the .env values)
//
// The SMTP password is encrypted at rest (AES-256-GCM, key derived
// from DATABASE_URL) and is never returned to the browser.
// ============================================================

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

// ---------- low-level key/value helpers ----------

async function readKeys(keys: readonly string[]): Promise<Map<string, string>> {
  const rows = await db.setting.findMany({ where: { key: { in: [...keys] } } });
  return new Map(rows.map((r) => [r.key, r.value]));
}

async function writeKeys(values: Record<string, string | null>) {
  await Promise.all(
    Object.entries(values).map(([key, value]) =>
      value === null
        ? db.setting.deleteMany({ where: { key } })
        : db.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
    )
  );
}

function intIn(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

// ---------- storage capacity ----------

/** Neon's free plan allows 0.5 GB per project - the default when nothing is set. */
export const DEFAULT_CAPACITY_MB = 512;

// ---------- image compression ----------

export type ImageConfig = {
  /** Compress new image uploads (re-encoded as WebP). */
  compress: boolean;
  /** Longest edge in pixels - larger photos are scaled down. */
  maxEdge: number;
  /** Encoder quality, 40–95. */
  quality: number;
};

export const DEFAULT_IMAGE_CONFIG: ImageConfig = { compress: true, maxEdge: 1920, quality: 80 };

const STORAGE_KEYS = ["storage.capacityMb", "images.compress", "images.maxEdge", "images.quality"] as const;

export type StorageConfig = ImageConfig & { capacityMb: number };

export async function getStorageConfig(): Promise<StorageConfig> {
  const m = await readKeys(STORAGE_KEYS);
  return {
    capacityMb: intIn(m.get("storage.capacityMb"), DEFAULT_CAPACITY_MB, 64, 1024 * 1024),
    compress: (m.get("images.compress") ?? String(DEFAULT_IMAGE_CONFIG.compress)) === "true",
    maxEdge: intIn(m.get("images.maxEdge"), DEFAULT_IMAGE_CONFIG.maxEdge, 640, 4096),
    quality: intIn(m.get("images.quality"), DEFAULT_IMAGE_CONFIG.quality, 40, 95),
  };
}

export async function updateStorageConfig(patch: Partial<StorageConfig>): Promise<StorageConfig> {
  const values: Record<string, string> = {};
  if (patch.capacityMb !== undefined) values["storage.capacityMb"] = String(patch.capacityMb);
  if (patch.compress !== undefined) values["images.compress"] = patch.compress ? "true" : "false";
  if (patch.maxEdge !== undefined) values["images.maxEdge"] = String(patch.maxEdge);
  if (patch.quality !== undefined) values["images.quality"] = String(patch.quality);
  await writeKeys(values);
  return getStorageConfig();
}

// ---------- mail (SMTP) ----------

const MAIL_KEYS = ["mail.host", "mail.port", "mail.user", "mail.pass", "mail.fromName"] as const;

/** Everything the mailer needs to connect. */
export type MailConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName: string;
};

/** Safe view for the admin panel - the password itself never leaves the server. */
export type MailSettingsView = {
  host: string;
  port: number;
  user: string;
  fromName: string;
  hasPassword: boolean;
  /** Where the active delivery settings come from. */
  source: "panel" | "env" | "none";
  /** A stored password could not be decrypted (DATABASE_URL changed) - re-enter it. */
  passwordUnreadable: boolean;
};

function cipherKey(): Buffer {
  return createHash("sha256")
    .update(`uniprojects:mail:${process.env.DATABASE_URL ?? ""}`)
    .digest();
}

function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cipherKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}

function decryptSecret(stored: string): string | null {
  try {
    const [v, iv, tag, data] = stored.split(":");
    if (v !== "v1" || !iv || !tag || !data) return null;
    const d = createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Sender name; the old "UniProjects" default becomes the new site name. */
function legacyName(v: string | undefined): string {
  return !v || v === "UniProjects" ? "Capstone Contest" : v;
}

function envMail(): MailConfig | null {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "");
  if (!user || !pass) return null;
  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 465,
    user,
    pass,
    fromName: legacyName(process.env.MAIL_FROM_NAME?.trim()),
  };
}

async function panelMail() {
  const m = await readKeys(MAIL_KEYS);
  const stored = m.get("mail.pass");
  const pass = stored ? decryptSecret(stored) : null;
  return {
    host: m.get("mail.host") || "smtp.gmail.com",
    port: intIn(m.get("mail.port"), 465, 1, 65535),
    user: m.get("mail.user") || "",
    pass,
    hasStoredPass: Boolean(stored),
    fromName: legacyName(m.get("mail.fromName")),
  };
}

/** Panel values win; a missing panel password falls back to the .env one for the same account. */
async function resolveMail() {
  const p = await panelMail();
  const env = envMail();
  if (!p.user) return { p, env, active: env, source: (env ? "env" : "none") as MailSettingsView["source"] };
  const pass = p.pass ?? (env && env.user === p.user ? env.pass : null);
  const active: MailConfig | null = pass
    ? { host: p.host, port: p.port, user: p.user, pass, fromName: p.fromName }
    : null;
  return { p, env, active, source: (active ? "panel" : env ? "env" : "none") as MailSettingsView["source"] };
}

/** Active SMTP settings, or null (mail is then only stored in the outbox). */
export async function getMailConfig(): Promise<MailConfig | null> {
  const { p, env, active } = await resolveMail();
  // panel account set but unusable → keep delivering with .env rather than stopping
  return active ?? (p.user ? env : null) ?? null;
}

export async function getMailSettingsView(): Promise<MailSettingsView> {
  const { p, env, active, source } = await resolveMail();
  // Nothing saved in the panel yet → show the .env values so admins see what is live.
  const shown = p.user ? p : env;
  return {
    host: shown?.host ?? "smtp.gmail.com",
    port: shown?.port ?? 465,
    user: shown?.user ?? "",
    fromName: shown?.fromName ?? "Capstone Contest",
    hasPassword: Boolean(active),
    source,
    passwordUnreadable: p.hasStoredPass && !p.pass,
  };
}

export async function updateMailSettings(patch: {
  host: string;
  port: number;
  user: string;
  fromName: string;
  /** undefined = keep the stored password, "" = remove it, anything else = replace. */
  pass?: string;
}): Promise<MailSettingsView> {
  const values: Record<string, string | null> = {
    "mail.host": patch.host,
    "mail.port": String(patch.port),
    "mail.user": patch.user,
    "mail.fromName": patch.fromName,
  };
  if (patch.pass !== undefined) {
    const clean = patch.pass.replace(/\s+/g, ""); // Gmail shows app passwords with spaces
    values["mail.pass"] = clean ? encryptSecret(clean) : null;
  }
  await writeKeys(values);
  return getMailSettingsView();
}

/** Forget every panel mail value - delivery falls back to .env. */
export async function clearMailSettings(): Promise<MailSettingsView> {
  await writeKeys(Object.fromEntries(MAIL_KEYS.map((k) => [k, null])));
  return getMailSettingsView();
}
