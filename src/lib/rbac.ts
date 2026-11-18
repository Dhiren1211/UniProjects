// ============================================================
// Role-based access control.
// Hierarchy (highest → lowest): ADMIN > MODERATOR > PROFESSOR > STUDENT.
// VISITOR = unauthenticated request (no User row).
// ============================================================

export const ROLES = ["ADMIN", "MODERATOR", "PROFESSOR", "STUDENT"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_RANK: Record<string, number> = {
  ADMIN: 4,
  MODERATOR: 3,
  PROFESSOR: 2,
  STUDENT: 1,
};

export type ActorLike = {
  role: string;
  isTeamLeader?: boolean;
  classId?: string | null;
} | null | undefined;

/** Role is one of the known roles. */
export function isValidRole(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role);
}

/** True when the role's rank is at least `min`. */
export function hasRoleAtLeast(role: string | null | undefined, min: Role): boolean {
  if (!role) return false;
  return (ROLE_RANK[role] ?? 0) >= ROLE_RANK[min];
}

export function isAdmin(role: string | null | undefined): boolean {
  return role === "ADMIN";
}

/** Full admin panel or the limited moderator variant. */
export function canAccessAdmin(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}

/** Professors and above - teaching staff who supervise projects. */
export function isFaculty(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR" || role === "PROFESSOR";
}

/**
 * Project submission gate (requirement 5): only team leaders may submit.
 * Admins/moderators/professors are staff and may submit on behalf of teams.
 */
export function canSubmitProject(actor: ActorLike): boolean {
  if (!actor) return false;
  if (isFaculty(actor.role)) return true;
  return actor.role === "STUDENT" && actor.isTeamLeader === true;
}

/**
 * Moderation capabilities (verification queue, reports):
 * moderators and admins; professors may act inside their own classes only.
 */
export function canModerateGlobal(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}

/** Setting changes, account approvals, user management writes, email outbox. */
export function canConfigureSite(role: string | null | undefined): boolean {
  return role === "ADMIN";
}

/**
 * Derive the university email for a student number - campus convention is a
 * lowercase "a" followed by the number: a2025679876@ks.ac.kr
 */
export function universityEmail(studentId: string): string {
  const id = studentId.trim().toLowerCase();
  return `${id.startsWith("a") ? id : `a${id}`}@ks.ac.kr`;
}

/**
 * Deterministic classID from capstone round, course year and professor:
 * CD2-2025-KIM. Collides intentionally for students in the same
 * section - that is what groups them under one professor.
 */
export function deriveClassId(capstone: string, year: number, professor: string): string {
  const round = capstone.replace(/^CD/i, "").toUpperCase(); // I | II | III
  const surname =
    professor
      .trim()
      .split(/\s+/)
      .pop()!
      .replace(/[^a-zA-Z가-힣]/g, "")
      .toUpperCase() || "STAFF";
  return `CD${round}-${year}-${surname}`;
}

/** Human-readable label for a role. */
export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case "ADMIN":
      return "Administrator";
    case "MODERATOR":
      return "Moderator";
    case "PROFESSOR":
      return "Professor";
    case "STUDENT":
      return "Student";
    default:
      return "Visitor";
  }
}
