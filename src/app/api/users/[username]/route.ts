import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, toSafeUser } from "@/lib/auth";
import {
  likeCountMap,
  mapPosts,
  postInclude,
  projectInclude,
  toListItem,
} from "../../_utils/serialize";
import type { ProfileResponse, ProjectListItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const deptSelect = { id: true, name: true, code: true, accent: true } as const;

// ---------- GET /api/users/[username] — public profile ----------

export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const user = await db.user.findUnique({
      where: { username: username.toLowerCase() },
      include: { department: { select: deptSelect } },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const viewer = await getSessionUser(req);
    const isSelf = viewer?.id === user.id;

    // published projects the user owns or is a member of; drafts visible to the profile owner
    const projectRows = await db.project.findMany({
      where: {
        OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
        ...(isSelf ? {} : { status: "PUBLISHED" }),
      },
      orderBy: { createdAt: "desc" },
      include: projectInclude,
    });

    const [postRows, followerCount, followingCount] = await Promise.all([
      db.post.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: postInclude,
      }),
      db.follow.count({ where: { targetType: "USER", targetId: user.id } }),
      db.follow.count({ where: { followerId: user.id } }),
    ]);

    const viewerFollows = viewer
      ? !!(await db.follow.findUnique({
          where: {
            followerId_targetType_targetId: {
              followerId: viewer.id,
              targetType: "USER",
              targetId: user.id,
            },
          },
        }))
      : false;

    const likes = await likeCountMap(
      "PROJECT",
      projectRows.map((p) => p.id)
    );

    const projects: ProjectListItem[] = projectRows.map((p) => toListItem(p, likes.get(p.id) ?? 0));
    const posts = await mapPosts(postRows, viewer?.id ?? null);

    const profile: ProfileResponse = {
      user: toSafeUser(user),
      projects,
      posts,
      followerCount,
      followingCount,
      viewerFollows,
    };

    return NextResponse.json(profile);
  } catch (e) {
    console.error("GET /api/users/[username]", e);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}
