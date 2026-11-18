import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/files/<name> - serves an UploadedFile. Public URLs are /uploads/<name>
// (rewritten here by next.config.ts). Names are random and immutable, so responses
// are cached for a year.

const NAME_RE = /^[a-z]+-[a-z0-9]+-[a-f0-9]+\.[a-z0-9]{1,8}$/;
const INLINE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!NAME_RE.test(name)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const file = await db.uploadedFile.findUnique({
      where: { name },
      select: { mime: true, data: true, size: true },
    });
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mime,
        "Content-Length": String(file.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `${INLINE.has(file.mime) ? "inline" : "attachment"}; filename="${name}"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (e) {
    console.error("GET /api/files failed:", e);
    return NextResponse.json({ error: "Could not load file" }, { status: 500 });
  }
}
