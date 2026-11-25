// ============================================================
// Server-side image compression (sharp).
// - New uploads: scaled to the configured longest edge and re-encoded
//   as WebP (much smaller than JPEG/PNG at the same visual quality).
// - Existing files: re-encoded in their own format so their URLs
//   (which carry the extension) keep working.
// GIFs are never touched (they may be animated).
// The result is only used when it is actually smaller.
// ============================================================

import sharp from "sharp";
import type { ImageConfig } from "@/lib/admin-config";

export type CompressResult = { data: Buffer; ext: string; mime: string; changed: boolean };

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** Formats sharp may re-encode (GIF excluded - animation). */
export function isCompressible(ext: string): boolean {
  return ext in MIME;
}

/**
 * Compress `input`. With `keepFormat` the output stays in `ext`'s format;
 * otherwise it becomes WebP. Returns the original bytes when that is smaller
 * or when the image can't be decoded.
 */
export async function compressImage(
  input: Buffer,
  ext: string,
  cfg: Pick<ImageConfig, "maxEdge" | "quality">,
  opts: { keepFormat?: boolean; maxEdge?: number } = {}
): Promise<CompressResult> {
  const original: CompressResult = { data: input, ext, mime: MIME[ext] ?? "application/octet-stream", changed: false };
  if (!isCompressible(ext)) return original;

  const edge = Math.min(cfg.maxEdge, opts.maxEdge ?? cfg.maxEdge);
  try {
    // rotate() applies the EXIF orientation; metadata (GPS etc.) is dropped by default
    let pipe = sharp(input, { failOn: "none" })
      .rotate()
      .resize({ width: edge, height: edge, fit: "inside", withoutEnlargement: true });

    let outExt = "webp";
    if (opts.keepFormat && (ext === "jpg" || ext === "jpeg")) {
      pipe = pipe.jpeg({ quality: cfg.quality, mozjpeg: true });
      outExt = ext;
    } else if (opts.keepFormat && ext === "png") {
      pipe = pipe.png({ compressionLevel: 9, palette: true, quality: cfg.quality, effort: 8 });
      outExt = "png";
    } else {
      pipe = pipe.webp({ quality: cfg.quality, effort: 5 });
    }

    const data = await pipe.toBuffer();
    if (data.length >= input.length) return original;
    return { data, ext: outExt, mime: MIME[outExt], changed: true };
  } catch (e) {
    console.error("compressImage failed - keeping the original:", e instanceof Error ? e.message : e);
    return original;
  }
}
