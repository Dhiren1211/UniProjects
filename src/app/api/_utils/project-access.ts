import { db } from "@/lib/db";
import { normalizeSupervisorName } from "./serialize";

/**
 * Who may manage a project (edit, team, status, resources, timeline,
 * verification request, delete) - the "owner tools":
 *   - administrators and moderators (any project)
 *   - the project leader: its owner, or a member with the OWNER / LEAD role
 *   - the project's own professor: same capstone section (classId), or the
 *     professor named as the project's supervisor
 * Other professors and students only get the public view.
 */

type Viewer = {
  id: string;
  role: string;
  classId?: string | null;
  displayName: string;
  professorName?: string | null;
};

type ProjectRef = {
  id: string;
  ownerId: string | null;
  classId: string | null;
  supervisor: string | null;
};

/** True when this professor supervises the project (section or named supervisor). */
export function isProjectProfessor(viewer: Viewer, project: ProjectRef): boolean {
  if (viewer.role !== "PROFESSOR") return false;
  if (viewer.classId && project.classId && viewer.classId === project.classId) return true;
  if (!project.supervisor) return false;
  const sup = normalizeSupervisorName(project.supervisor);
  return [viewer.displayName, viewer.professorName]
    .filter((n): n is string => Boolean(n))
    .some((n) => normalizeSupervisorName(n) === sup);
}

export async function canManageProject(
  viewer: Viewer | null | undefined,
  project: ProjectRef,
): Promise<boolean> {
  if (!viewer) return false;
  if (viewer.role === "ADMIN" || viewer.role === "MODERATOR") return true;
  if (project.ownerId && project.ownerId === viewer.id) return true;
  if (isProjectProfessor(viewer, project)) return true;
  const lead = await db.projectMember.findFirst({
    where: { projectId: project.id, userId: viewer.id, role: { in: ["OWNER", "LEAD"] } },
    select: { id: true },
  });
  return Boolean(lead);
}

/**
 * Who may APPROVE a project for publication: administrators, or the project's
 * own professor (same section, or named as supervisor). Nobody else can make a
 * project public.
 */
export function canReviewProject(viewer: Viewer | null | undefined, project: ProjectRef): boolean {
  if (!viewer) return false;
  if (viewer.role === "ADMIN") return true;
  return isProjectProfessor(viewer, project);
}

/**
 * Accounts to notify when a project is sent for approval: its professor(s) and
 * every administrator.
 */
export async function reviewerIds(project: { classId: string | null; supervisor: string | null }): Promise<string[]> {
  const [admins, professors] = await Promise.all([
    db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }),
    db.user.findMany({
      where: { role: "PROFESSOR" },
      select: { id: true, role: true, classId: true, displayName: true, professorName: true },
    }),
  ]);
  const ref = { id: "", ownerId: null, classId: project.classId, supervisor: project.supervisor };
  const profs = professors.filter((p) => isProjectProfessor(p, ref));
  return [...new Set([...admins, ...profs].map((u) => u.id))];
}

/** Statuses a project can be in. Only PUBLISHED is visible to the public. */
export const PROJECT_STATUSES = ["DRAFT", "PENDING", "PUBLISHED", "REJECTED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
