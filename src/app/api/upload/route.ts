import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { canConfigureSite } from "@/lib/rbac";

export const dynamic = "force-dynamic";

// ---------- POST multipart { file, kind } - store a file under /uploads and return its URL ----------
// Restored after it went missing in an earlier commit (every upload in the app 404'd), plus a
// "hero" kind for the landing page background, which only site administrators may upload.

const KINDS = ["avatar", "cover", "gallery", "resource", "hero"] as const;
type Kind = (typeof KINDS)[number];

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "gif"] as const;

const EXTS_BY_KIND: Record<Kind, readonly string[]> = {
  avatar: IMAGE_EXTS,
  cover: IMAGE_EXTS,
  gallery: IMAGE_EXTS,
  hero: ["png", "jpg", "jpeg", "webp"],
  resource: [...IMAGE_EXTS, "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "zip", "txt", "md", "csv"],
};

const MAX_BYTES_BY_KIND: Record<Kind, number> = {
  avatar: 2 * 1024 * 1024,
  cover: 6 * 1024 * 1024,
  gallery: 6 * 1024 * 1024,
  hero: 8 * 1024 * 1024,
  resource: 15 * 1024 * 1024,
};

/** The rest of the app validates resource/image URLs as /uploads/<[a-z0-9/-]+>.<ext> - keep names conformant. */
function safeExt(fileName: string, mime: string, allowed: readonly string[]): string | null {
  const fromName = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  const guess: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "text/plain": "txt",
    "text/markdown": "md",
    "text/csv": "csv",
    "application/zip": "zip",
  };
  const ext = fromName || guess[mime] || "";
  return allowed.includes(ext) ? ext : null;
}

/** For images, the bytes must match the extension (a renamed file is refused). */
function looksLikeImage(buf: Buffer, ext: string): boolean {
  const starts = (...b: number[]) => b.every((v, i) => buf[i] === v);
  switch (ext) {
    case "png":
      return starts(0x89, 0x50, 0x4e, 0x47);
    case "jpg":
    case "jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "gif":
      return starts(0x47, 0x49, 0x46, 0x38);
    case "webp":
      return starts(0x52, 0x49, 0x46, 0x46) && buf.subarray(8, 12).toString("ascii") === "WEBP";
    default:
      return true; // non-image resources are not sniffed
  }
}

export async function POST(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!viewer) return NextResponse.json({ error: "Sign in to upload files" }, { status: 401 });

    const form = await req.formData();
    const kindRaw = String(form.get("kind") ?? "");
    if (!KINDS.includes(kindRaw as Kind)) {
      return NextResponse.json({ error: "Unknown upload kind" }, { status: 400 });
    }
    const kind = kindRaw as Kind;

    if (kind === "hero" && !canConfigureSite(viewer.role)) {
      return NextResponse.json({ error: "Only administrators can change the hero image" }, { status: 403 });
    }

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "No file was attached" }, { status: 400 });
    }
    if (file.size > MAX_BYTES_BY_KIND[kind]) {
      return NextResponse.json(
        { error: `File is too large - the limit is ${Math.round(MAX_BYTES_BY_KIND[kind] / 1024 / 1024)} MB` },
        { status: 413 }
      );
    }

    const ext = safeExt(file.name, file.type, EXTS_BY_KIND[kind]);
    if (!ext) {
      return NextResponse.json({ error: "That file type isn't supported here" }, { status: 415 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (!looksLikeImage(buf, ext)) {
      return NextResponse.json({ error: "That file isn't a valid image" }, { status: 415 });
    }

    const name = `${kind}-${Date.now().toString(36)}-${randomBytes(5).toString("hex")}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buf);

    return NextResponse.json({ url: `/uploads/${name}` });
  } catch (e) {
    console.error("POST /api/upload failed:", e);
    return NextResponse.json({ error: "Upload failed - please try again" }, { status: 500 });
  }
}
