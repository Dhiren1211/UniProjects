import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const RESOURCE_TYPES: Record<string, string> = {
  ...IMAGE_TYPES,
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "application/zip": ".zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-excel": ".xls",
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_RESOURCE_BYTES = 25 * 1024 * 1024; // 25 MB

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Invalid multipart form data.", 400);
  }

  const file = form.get("file");
  const kind = form.get("kind");

  if (!(file instanceof File)) {
    return errorResponse('Missing file. Send it using the "file" field.', 400);
  }

  if (kind !== "avatar" && kind !== "cover" && kind !== "gallery" && kind !== "resource") {
    return errorResponse('Invalid upload kind. Use "avatar", "cover", "gallery", or "resource".', 400);
  }

  if (file.size <= 0) {
    return errorResponse("The uploaded file is empty.", 400);
  }

  const isResource = kind === "resource";
  const maxBytes = isResource ? MAX_RESOURCE_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    return errorResponse(
      isResource ? "File is too large. Maximum resource size is 25 MB." : "Image is too large. Maximum image size is 10 MB.",
      413
    );
  }

  const allowedTypes = isResource ? RESOURCE_TYPES : IMAGE_TYPES;
  const extension = allowedTypes[file.type];
  if (!extension) {
    return errorResponse(
      isResource
        ? "Unsupported file type. Upload an image, PDF, Office document, ZIP, TXT, or Markdown file."
        : "Unsupported image type. Use JPEG, PNG, WebP, or GIF.",
      415
    );
  }

  // Never use the user-supplied filename as a filesystem path.
  const filename = `${kind}-${randomUUID()}${extension}`;
  const subdirectory =
    kind === "avatar" ? "avatars" : kind === "cover" ? "covers" : kind === "gallery" ? "gallery" : "resources";
  const uploadDirectory = path.join(process.cwd(), "public", "uploads", subdirectory);
  const destination = path.join(uploadDirectory, filename);

  try {
    await mkdir(uploadDirectory, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(destination, bytes, { flag: "wx" });
  } catch (error) {
    console.error("Upload failed:", error);
    return errorResponse("Could not save the uploaded file. Please try again.", 500);
  }

  return NextResponse.json({ url: `/uploads/${subdirectory}/${filename}` }, { status: 201 });
}
