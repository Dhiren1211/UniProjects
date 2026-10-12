import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import type { AdminDepartmentDTO } from "@/lib/types";
import { requireAdmin } from "../_guard";

export const dynamic = "force-dynamic";

const ACCENT_VALUES = ["teal", "sky", "orange", "rose", "lime", "violet"] as const;

// Uppercase A–Z / 0–9, 2–8 chars — normalized to uppercase before validation
const codeSchema = z
  .string()
  .trim()
  .min(2, "Code must be 2–8 uppercase characters")
  .max(8, "Code must be 2–8 uppercase characters")
  .transform((v) => v.toUpperCase())
  .refine((v) => /^[A-Z0-9]+$/.test(v), "Code may only use uppercase letters and numbers");

const deptFields = {
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80, "Name is too long"),
  code: codeSchema,
  tagline: z
    .string()
    .trim()
    .max(120, "Tagline must be 120 characters or fewer")
    .optional()
    .or(z.literal("")),
  accent: z.enum(ACCENT_VALUES).optional(),
  sortOrder: z
    .number()
    .int("Sort order must be a whole number")
    .min(0, "Sort order cannot be negative")
    .optional(),
};

function toDTO(d: {
  id: string;
  name: string;
  code: string;
  tagline: string | null;
  accent: string;
  sortOrder: number;
  _count?: { projects: number };
}): AdminDepartmentDTO {
  return {
    id: d.id,
    name: d.name,
    code: d.code,
    tagline: d.tagline,
    accent: d.accent,
    sortOrder: d.sortOrder,
    projectCount: d._count?.projects ?? 0,
  };
}

// ---------- GET — every department with an all-status project count ----------

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const rows = await db.department.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { projects: true } } },
    });

    return NextResponse.json({ departments: rows.map(toDTO) });
  } catch (e) {
    console.error("GET /api/admin/departments", e);
    return NextResponse.json({ error: "Failed to load departments" }, { status: 500 });
  }
}

// ---------- POST — create a department ----------

const createSchema = z.object(deptFields);

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { name, code, tagline, accent, sortOrder } = parsed.data;

    const dupe = await db.department.findUnique({ where: { code } });
    if (dupe) {
      return NextResponse.json(
        { error: "A department with this code already exists" },
        { status: 409 }
      );
    }

    const created = await db.department.create({
      data: {
        name,
        code,
        tagline: tagline || null,
        accent: accent ?? "teal",
        sortOrder: sortOrder ?? 0,
      },
    });

    return NextResponse.json({ department: toDTO(created) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/departments", e);
    return NextResponse.json({ error: "Failed to create the department" }, { status: 500 });
  }
}

// ---------- PATCH { id, ...fields } — edit a department ----------

const patchSchema = z
  .object({
    id: z.string().min(1),
    name: deptFields.name.optional(),
    code: codeSchema.optional(),
    tagline: deptFields.tagline,
    accent: deptFields.accent,
    sortOrder: deptFields.sortOrder,
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.code !== undefined ||
      d.tagline !== undefined ||
      d.accent !== undefined ||
      d.sortOrder !== undefined,
    { message: "Nothing to update" }
  );

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { id, name, code, tagline, accent, sortOrder } = parsed.data;

    const existing = await db.department.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }

    if (code !== undefined && code !== existing.code) {
      const dupe = await db.department.findUnique({ where: { code } });
      if (dupe && dupe.id !== id) {
        return NextResponse.json(
          { error: "A department with this code already exists" },
          { status: 409 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (code !== undefined) data.code = code;
    if (tagline !== undefined) data.tagline = tagline || null;
    if (accent !== undefined) data.accent = accent;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    const updated = await db.department.update({
      where: { id },
      data,
      include: { _count: { select: { projects: true } } },
    });

    return NextResponse.json({ department: toDTO(updated) });
  } catch (e) {
    console.error("PATCH /api/admin/departments", e);
    return NextResponse.json({ error: "Failed to update the department" }, { status: 500 });
  }
}

// ---------- DELETE ?id= — blocked while projects reference the department ----------

export async function DELETE(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return gate.denied;

    const id = req.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Missing department id" }, { status: 400 });
    }

    const dept = await db.department.findUnique({
      where: { id },
      include: { _count: { select: { projects: true } } },
    });
    if (!dept) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }
    if (dept._count.projects > 0) {
      return NextResponse.json(
        { error: "Department has projects — move or delete them first" },
        { status: 409 }
      );
    }

    await db.department.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/admin/departments", e);
    return NextResponse.json({ error: "Failed to delete the department" }, { status: 500 });
  }
}
