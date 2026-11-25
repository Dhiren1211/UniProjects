import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getStorageConfig } from "@/lib/admin-config";
import { compressImage } from "@/lib/image-compress";
import { requireAdmin } from "../../_guard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// POST /api/admin/storage/compress - shrink images that were uploaded
// before compression was on (ADMIN only).
//
// Works in small batches so each call stays well inside the serverless
// time limit - the admin panel calls it repeatedly until `remaining` is 0.
// Files keep their name and format (URLs contain the extension), are only
// replaced when the result is smaller, and are marked so they are never
// re-encoded twice.
// ============================================================

const BATCH = 8;
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const EXT_BY_MIME: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (!gate.ok) return gate.denied;

  try {
    const cfg = await getStorageConfig();
    const batch = await db.uploadedFile.findMany({
      where: { compressed: false, mime: { in: IMAGE_MIMES } },
      orderBy: { size: "desc" }, // biggest wins first
      take: BATCH,
      select: { id: true, mime: true, kind: true, size: true, data: true },
    });

    let savedBytes = 0;
    for (const f of batch) {
      const out = await compressImage(Buffer.from(f.data), EXT_BY_MIME[f.mime], cfg, {
        keepFormat: true,
        maxEdge: f.kind === "avatar" ? 512 : f.kind === "hero" ? 2560 : undefined,
      });
      // only keep a meaningful win (≥ 5 %) - otherwise just mark it done
      if (out.changed && out.data.length < f.size * 0.95) {
        savedBytes += f.size - out.data.length;
        await db.uploadedFile.update({
          where: { id: f.id },
          data: { data: new Uint8Array(out.data), size: out.data.length, compressed: true },
        });
      } else {
        await db.uploadedFile.update({ where: { id: f.id }, data: { compressed: true } });
      }
    }

    const remaining = await db.uploadedFile.count({
      where: { compressed: false, mime: { in: IMAGE_MIMES } },
    });

    if (batch.length > 0) {
      await audit(
        gate.viewer,
        "settings.compress",
        { type: "SETTINGS", label: "existing images" },
        `${batch.length} processed, ${Math.round(savedBytes / 1024)} KB saved`
      );
    }

    return NextResponse.json({ processed: batch.length, savedBytes, remaining });
  } catch (e) {
    console.error("POST /api/admin/storage/compress", e);
    return NextResponse.json({ error: "Compression failed - please try again" }, { status: 500 });
  }
}
