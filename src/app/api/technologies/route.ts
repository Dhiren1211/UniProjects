import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { TechnologyDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

// ---------- GET — technology catalog, grouped by category then name ----------

export async function GET() {
  try {
    const rows = await db.technology.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    const technologies: TechnologyDTO[] = rows.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      category: t.category,
    }));

    return NextResponse.json({ technologies });
  } catch (e) {
    console.error("GET /api/technologies", e);
    return NextResponse.json({ error: "Failed to load technologies" }, { status: 500 });
  }
}

// ---------- POST { name } — register a custom tool ("Other") ----------

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

export async function POST(req: NextRequest) {
  try {
    const viewer = await getSessionUser(req);
    if (!viewer) {
      return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (name.length < 2 || name.length > 40) {
      return NextResponse.json(
        { error: "Tool name must be 2–40 characters" },
        { status: 400 }
      );
    }

    const slug = slugify(name);
    if (!slug) {
      return NextResponse.json({ error: "Tool name must include letters or numbers" }, { status: 400 });
    }

    // Reuse an existing tool when the name (or slug) is already in the catalog.
    const existing = await db.technology.findFirst({
      where: { OR: [{ slug }, { name: { equals: name } }] },
    });
    if (existing) {
      const t: TechnologyDTO = {
        id: existing.id,
        name: existing.name,
        slug: existing.slug,
        category: existing.category,
      };
      return NextResponse.json({ technology: t, created: false });
    }

    const row = await db.technology.create({
      data: { name, slug, category: "Other" },
    });
    const technology: TechnologyDTO = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: row.category,
    };
    return NextResponse.json({ technology, created: true }, { status: 201 });
  } catch (e) {
    console.error("POST /api/technologies", e);
    return NextResponse.json({ error: "Could not add the tool" }, { status: 500 });
  }
}
