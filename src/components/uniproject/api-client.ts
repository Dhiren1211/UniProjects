"use client";

// ============================================================
// UniProjects - typed fetch client. THE contract used by all
// views. Backend routes must match these paths + payloads.
// ============================================================

import type {
  AccountRequestDTO,
  AdminDepartmentDTO,
  AdminOverviewDTO,
  AdminProjectRow,
  AdminUserRow,
  AnnouncementDTO,
  ApprovalResultDTO,
  CommentDTO,
  DepartmentDTO,
  EmailLogDTO,
  JoinRequestDTO,
  MailSettingsDTO,
  NotificationDTO,
  PasswordResetRow,
  ProfileResponse,
  ProjectDetailResponse,
  ProjectListItem,
  ReportDTO,
  SafeUserDTO,
  SearchResults,
  SiteSettings,
  StatsDTO,
  StorageConfigDTO,
  StorageReportDTO,
  TechnologyDTO,
  VerificationDTO,
} from "@/lib/types";

export type * from "@/lib/types";

export type View =
  | { name: "home" }
  | { name: "projects"; q?: string; dept?: string; category?: string; year?: number }
  | { name: "project"; slug: string }
  | { name: "profile"; username: string }
  | { name: "settings" }
  | { name: "notifications" }
  | { name: "admin"; tab?: string }
  | { name: "create"; editSlug?: string }
  | { name: "announcements" }
  | { name: "guidelines" }
  | { name: "dashboard" }
  | { name: "account-request" };

export type Navigate = (v: View) => void;

// ---------- internals ----------

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  return fetch(url, { signal }).then((r) => handle<T>(r));
}

function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  return fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).then((r) => handle<T>(r));
}

// ---------- auth ----------

export async function fetchMe(signal?: AbortSignal): Promise<SafeUserDTO | null> {
  const data = await get<{ user: SafeUserDTO | null }>("/api/auth/me", signal);
  return data.user;
}

export async function login(payload: { login: string; password: string }): Promise<SafeUserDTO> {
  const data = await send<{ user: SafeUserDTO }>("/api/auth/login", "POST", payload);
  return data.user;
}

/**
 * Forgot password - asks for the university email. The response is
 * intentionally neutral: a temporary password is only emailed when the
 * address belongs to a registered account (every attempt lands in the
 * admin panel's Resets log either way).
 */
/** login = student ID (students) or username (staff); an email also works. */
export async function requestPasswordReset(login: string): Promise<{ ok: boolean; message: string }> {
  return send<{ ok: boolean; message: string }>("/api/auth/forgot-password", "POST", { login });
}

export async function logout(): Promise<void> {
  await send<{ ok: boolean }>("/api/auth/logout", "POST");
}

// ---------- site settings ----------

export async function fetchSettings(signal?: AbortSignal): Promise<SiteSettings> {
  const data = await get<{ settings: SiteSettings }>("/api/settings", signal);
  return data.settings;
}

export async function updateSiteSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const data = await send<{ settings: SiteSettings }>("/api/settings", "PUT", patch);
  return data.settings;
}

// ---------- admin: storage + image compression ----------

export function fetchStorageReport(signal?: AbortSignal): Promise<StorageReportDTO> {
  return get<StorageReportDTO>("/api/admin/storage", signal);
}

export async function updateStorageConfig(patch: Partial<StorageConfigDTO>): Promise<StorageConfigDTO> {
  const data = await send<{ config: StorageConfigDTO }>("/api/admin/storage", "PUT", patch);
  return data.config;
}

/** One batch of the "compress existing images" job - call until remaining is 0. */
export function compressExistingImages(): Promise<{ processed: number; savedBytes: number; remaining: number }> {
  return send("/api/admin/storage/compress", "POST");
}

// ---------- admin: email delivery (SMTP) ----------

export async function fetchMailSettings(signal?: AbortSignal): Promise<MailSettingsDTO> {
  const data = await get<{ mail: MailSettingsDTO }>("/api/admin/mail-settings", signal);
  return data.mail;
}

export async function saveMailSettings(input: {
  host: string;
  port: number;
  user: string;
  fromName: string;
  pass?: string;
}): Promise<MailSettingsDTO> {
  const data = await send<{ mail: MailSettingsDTO }>("/api/admin/mail-settings", "PUT", input);
  return data.mail;
}

export async function resetMailSettings(): Promise<MailSettingsDTO> {
  const data = await send<{ mail: MailSettingsDTO }>("/api/admin/mail-settings", "DELETE");
  return data.mail;
}

export function sendTestEmail(): Promise<{ delivered: boolean; to: string }> {
  return send("/api/admin/mail-settings/send-test", "POST");
}

// ---------- account requests (public intake → admin approval) ----------

export type AccountRequestInput =
  | {
      role: "STUDENT";
      studentId: string;
      name: string;
      capstone: "I" | "II" | "III";
      year: number;
      professor: string;
    }
  | { role: "PROFESSOR"; email: string; name: string };

export async function submitAccountRequest(
  input: AccountRequestInput
): Promise<{ request: AccountRequestDTO; universityEmail: string; message: string }> {
  return send("/api/account-requests", "POST", input);
}

export async function fetchAccountRequests(
  status?: "PENDING" | "APPROVED" | "REJECTED" | "ALL",
  signal?: AbortSignal
): Promise<AccountRequestDTO[]> {
  const qs = status && status !== "ALL" ? `?status=${status}` : "";
  const data = await get<{ requests: AccountRequestDTO[] }>(`/api/account-requests${qs}`, signal);
  return data.requests;
}

export async function decideAccountRequest(
  id: string,
  body: { decision: "APPROVED" | "REJECTED"; classId?: string; teamRole: "LEADER" | "MEMBER"; note?: string }
): Promise<ApprovalResultDTO> {
  return send(`/api/account-requests/${id}`, "PATCH", body);
}

export async function deleteAccountRequest(id: string): Promise<void> {
  await send<{ ok: boolean }>(`/api/account-requests/${id}`, "DELETE");
}

// ---------- announcements ----------

export async function fetchAnnouncements(signal?: AbortSignal): Promise<AnnouncementDTO[]> {
  const data = await get<{ announcements: AnnouncementDTO[] }>("/api/announcements", signal);
  return data.announcements;
}

export async function createAnnouncement(input: {
  title: string;
  body: string;
  pinned?: boolean;
}): Promise<AnnouncementDTO> {
  const data = await send<{ announcement: AnnouncementDTO }>("/api/announcements", "POST", input);
  return data.announcement;
}

export async function updateAnnouncement(
  id: string,
  patch: { title?: string; body?: string; pinned?: boolean }
): Promise<AnnouncementDTO> {
  const data = await send<{ announcement: AnnouncementDTO }>(`/api/announcements/${id}`, "PATCH", patch);
  return data.announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await send<{ ok: boolean }>(`/api/announcements/${id}`, "DELETE");
}

// ---------- meta ----------

export async function fetchStats(signal?: AbortSignal): Promise<StatsDTO> {
  const data = await get<{ stats: StatsDTO }>("/api/stats", signal);
  return data.stats;
}

export async function fetchDepartments(signal?: AbortSignal): Promise<DepartmentDTO[]> {
  const data = await get<{ departments: DepartmentDTO[] }>("/api/departments", signal);
  return data.departments;
}

export async function fetchTechnologies(signal?: AbortSignal): Promise<TechnologyDTO[]> {
  const data = await get<{ technologies: TechnologyDTO[] }>("/api/technologies", signal);
  return data.technologies;
}

/** Register a custom tool ("Other") - returns the existing one if the name is already known. */
export async function createTechnology(name: string): Promise<TechnologyDTO> {
  const data = await send<{ technology: TechnologyDTO }>("/api/technologies", "POST", { name });
  return data.technology;
}

// ---------- uploads ----------

export type UploadKind = "avatar" | "cover" | "gallery" | "resource" | "hero";

/** Server-side caps (must match /api/upload - Vercel rejects bodies over 4.5 MB). */
const UPLOAD_MAX_BYTES: Record<UploadKind, number> = {
  avatar: 2 * 1024 * 1024,
  cover: 4 * 1024 * 1024,
  gallery: 4 * 1024 * 1024,
  hero: 4 * 1024 * 1024,
  resource: 4 * 1024 * 1024,
};

/**
 * Downsize a too-large photo in the browser (max 2560px edge, JPEG) so it fits
 * the upload cap. GIFs and non-images are returned untouched.
 */
async function shrinkImage(file: File, maxBytes: number): Promise<File> {
  if (file.size <= maxBytes || !/^image\/(png|jpeg|webp)$/.test(file.type)) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  let edge = 2560;
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (blob && blob.size <= maxBytes) {
      bitmap.close();
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    }
    edge = Math.round(edge * 0.75);
  }
  bitmap.close();
  return file;
}

/**
 * Upload a file to /api/upload and resolve with its served URL.
 * Uses XHR so callers can render real progress. onProgress gets 0–100.
 */
export async function uploadFile(
  original: File,
  kind: UploadKind,
  onProgress?: (pct: number) => void
): Promise<string> {
  const maxBytes = UPLOAD_MAX_BYTES[kind];
  const file = await shrinkImage(original, maxBytes);
  if (file.size > maxBytes) {
    throw new Error(`File is too large - the limit is ${Math.round(maxBytes / 1024 / 1024)} MB`);
  }
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("file", file);
    form.set("kind", kind);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.responseType = "json";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onload = () => {
      const body = (xhr.response ?? {}) as { url?: string; error?: string };
      if (xhr.status >= 200 && xhr.status < 300 && body.url) {
        resolve(body.url);
      } else {
        reject(new Error(body.error ?? `Upload failed (${xhr.status})`));
      }
    };
    xhr.send(form);
  });
}

// ---------- projects ----------

export async function fetchProjects(
  params: Record<string, string | number | undefined>,
  signal?: AbortSignal
): Promise<ProjectListItem[]> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  }
  const data = await get<{ projects: ProjectListItem[] }>(`/api/projects?${sp.toString()}`, signal);
  return data.projects;
}

export async function fetchProject(
  slug: string,
  signal?: AbortSignal
): Promise<ProjectDetailResponse> {
  return get<ProjectDetailResponse>(`/api/projects/${slug}`, signal);
}

export type ProjectInput = {
  title: string;
  summary: string;
  description: string;
  category: string;
  year: number;
  semester: string;
  dept: string;
  program?: string;
  supervisor?: string;
  tags?: string[];
  demoUrl?: string;
  repoUrl?: string;
  coverImage?: string;
  galleryImages?: string[];
  publish?: boolean;
  technologyIds?: string[];
  allowJoinRequests?: boolean;
  lookingForTeammates?: boolean;
  members?: { username: string; role: string }[];
};

export async function createProject(payload: ProjectInput): Promise<ProjectListItem> {
  const data = await send<{ project: ProjectListItem }>("/api/projects", "POST", payload);
  return data.project;
}

export async function updateProject(slug: string, payload: Partial<ProjectInput>): Promise<void> {
  await send(`/api/projects/${slug}`, "PATCH", payload);
}

export async function deleteProject(slug: string): Promise<void> {
  await send(`/api/projects/${slug}`, "DELETE");
}

/** Approve (→ public) or send back with a note. Admin or the project's professor only. */
export function reviewProject(
  slug: string,
  decision: "APPROVE" | "REJECT",
  note?: string
): Promise<{ ok: true; status: string }> {
  return send(`/api/projects/${slug}/review`, "POST", { decision, ...(note ? { note } : {}) });
}

export type ReviewQueueItem = ProjectListItem & { submittedAt: string | null; supervisor: string | null };

/** Projects waiting for the signed-in reviewer's approval. */
export async function fetchReviewQueue(signal?: AbortSignal): Promise<ReviewQueueItem[]> {
  const data = await get<{ projects: ReviewQueueItem[] }>("/api/reviews", signal);
  return data.projects;
}

export async function setProjectStatus(slug: string, status: "DRAFT" | "PUBLISHED"): Promise<void> {
  await send(`/api/projects/${slug}`, "PATCH", { status });
}

/** Replace the project's gallery image order / contents (owner or staff). */
export async function setProjectGallery(slug: string, galleryImages: string[]): Promise<void> {
  await send(`/api/projects/${slug}`, "PATCH", { galleryImages });
}

// ---------- project membership ----------

export async function addMember(
  slug: string,
  payload: { username: string; role: string }
): Promise<void> {
  await send(`/api/projects/${slug}/members`, "POST", payload);
}

export async function updateMember(
  slug: string,
  payload: { memberId: string; role: string }
): Promise<void> {
  await send(`/api/projects/${slug}/members`, "PATCH", payload);
}

export async function removeMember(
  slug: string,
  payload: { memberId?: string; self?: boolean }
): Promise<void> {
  await send(`/api/projects/${slug}/members`, "DELETE", payload);
}

export async function requestToJoin(slug: string, message?: string): Promise<void> {
  await send(`/api/projects/${slug}/join`, "POST", { message });
}

export async function cancelJoinRequest(slug: string): Promise<void> {
  await send(`/api/projects/${slug}/join`, "DELETE");
}

export async function fetchJoinRequests(slug: string): Promise<JoinRequestDTO[]> {
  const data = await get<{ requests: JoinRequestDTO[] }>(`/api/projects/${slug}/join-requests`);
  return data.requests;
}

export async function decideJoinRequest(
  slug: string,
  payload: { requestId: string; decision: "APPROVED" | "REJECTED" }
): Promise<void> {
  await send(`/api/projects/${slug}/join-requests`, "PATCH", payload);
}

// ---------- project resources / timeline / discussion ----------

export async function addResource(
  slug: string,
  payload: { type: string; label: string; url: string }
): Promise<void> {
  await send(`/api/projects/${slug}/resources`, "POST", payload);
}

export async function deleteResource(slug: string, resourceId: string): Promise<void> {
  await send(`/api/projects/${slug}/resources`, "DELETE", { resourceId });
}

export async function addTimelineItem(
  slug: string,
  payload: { title: string; date: string; note?: string }
): Promise<void> {
  await send(`/api/projects/${slug}/timeline`, "POST", payload);
}

export async function deleteTimelineItem(slug: string, itemId: string): Promise<void> {
  await send(`/api/projects/${slug}/timeline`, "DELETE", { itemId });
}

export async function fetchComments(slug: string): Promise<CommentDTO[]> {
  const data = await get<{ comments: CommentDTO[] }>(`/api/projects/${slug}/comments`);
  return data.comments;
}

export async function addComment(slug: string, body: string): Promise<CommentDTO> {
  const data = await send<{ comment: CommentDTO }>(`/api/projects/${slug}/comments`, "POST", { body });
  return data.comment;
}

// ---------- verification / reports ----------

export async function requestVerification(slug: string): Promise<void> {
  await send(`/api/projects/${slug}/verify`, "POST");
}

export async function fetchVerifications(): Promise<VerificationDTO[]> {
  const data = await get<{ verifications: VerificationDTO[] }>("/api/moderation/verifications");
  return data.verifications;
}

export async function decideVerification(
  payload: { verificationId: string; decision: "APPROVED" | "REJECTED" }
): Promise<void> {
  await send("/api/moderation/verifications", "PATCH", payload);
}

export async function fileReport(payload: {
  targetType: string;
  targetId: string;
  reason: string;
}): Promise<void> {
  await send("/api/reports", "POST", payload);
}

export async function fetchReports(): Promise<ReportDTO[]> {
  const data = await get<{ reports: ReportDTO[] }>("/api/reports");
  return data.reports;
}

export async function resolveReport(reportId: string): Promise<void> {
  await send(`/api/reports/${reportId}`, "PATCH", { status: "RESOLVED" });
}

// ---------- engagement toggles ----------

export async function toggleBookmark(payload: {
  targetType: "PROJECT" | "POST";
  targetId: string;
}): Promise<{ active: boolean }> {
  return send<{ active: boolean }>("/api/bookmarks", "POST", payload);
}

export async function fetchMyBookmarks(signal?: AbortSignal): Promise<ProjectListItem[]> {
  const data = await get<{ projects: ProjectListItem[] }>("/api/bookmarks", signal);
  return data.projects;
}

export async function toggleFollow(payload: {
  targetType: "USER" | "PROJECT";
  targetId: string;
}): Promise<{ active: boolean }> {
  return send<{ active: boolean }>("/api/follow", "POST", payload);
}

export async function toggleLike(payload: {
  targetType: "POST" | "PROJECT";
  targetId: string;
}): Promise<{ active: boolean }> {
  return send<{ active: boolean }>("/api/likes", "POST", payload);
}

// ---------- users ----------

export async function fetchProfile(username: string, signal?: AbortSignal): Promise<ProfileResponse> {
  return get<ProfileResponse>(`/api/users/${username}`, signal);
}

export async function updateProfile(
  payload: Partial<SafeUserDTO> & {
    currentPassword?: string;
    newPassword?: string;
    avatarUrl?: string | null;
  }
): Promise<SafeUserDTO> {
  const data = await send<{ user: SafeUserDTO }>("/api/users", "PATCH", payload);
  return data.user;
}

export async function searchUsers(
  query: string,
  signal?: AbortSignal
): Promise<SafeUserDTO[]> {
  const data = await get<{ users: SafeUserDTO[] }>(
    `/api/users?query=${encodeURIComponent(query)}&pageSize=8`,
    signal
  );
  return data.users;
}

// ---------- notifications ----------

export async function fetchNotifications(signal?: AbortSignal): Promise<NotificationDTO[]> {
  const data = await get<{ notifications: NotificationDTO[] }>("/api/notifications", signal);
  return data.notifications;
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  await send("/api/notifications", "PATCH", ids ? { ids } : { all: true });
}

// ---------- search ----------

export async function globalSearch(q: string, signal?: AbortSignal): Promise<SearchResults> {
  return get<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`, signal);
}

// ---------- admin panel (ADMIN + MODERATOR; writes are ADMIN only) ----------

export async function fetchAdminOverview(signal?: AbortSignal): Promise<AdminOverviewDTO> {
  return get<AdminOverviewDTO>("/api/admin/overview", signal);
}

export async function fetchAdminProjects(
  params: { query?: string; status?: string; dept?: string },
  signal?: AbortSignal
): Promise<AdminProjectRow[]> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const data = await get<{ projects: AdminProjectRow[] }>(
    `/api/admin/projects?${sp.toString()}`,
    signal
  );
  return data.projects;
}

export async function updateAdminProject(payload: {
  id: string;
  featured?: boolean;
  status?: "DRAFT" | "PUBLISHED";
}): Promise<ProjectListItem> {
  const data = await send<{ project: ProjectListItem }>("/api/admin/projects", "PATCH", payload);
  return data.project;
}

export async function deleteAdminProject(id: string): Promise<void> {
  await send<{ ok: boolean }>(`/api/admin/projects?id=${encodeURIComponent(id)}`, "DELETE");
}

export type AuditEntry = {
  id: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string;
  details: string | null;
  createdAt: string;
};

/** Audit trail (admin). `before` = createdAt of the last row, for the next page. */
export async function fetchActivity(
  filters: { q?: string; area?: string; before?: string } = {},
  signal?: AbortSignal
): Promise<{ entries: AuditEntry[]; hasMore: boolean }> {
  const sp = new URLSearchParams();
  if (filters.q?.trim()) sp.set("q", filters.q.trim());
  if (filters.area && filters.area !== "ALL") sp.set("area", filters.area);
  if (filters.before) sp.set("before", filters.before);
  const qs = sp.toString() ? `?${sp}` : "";
  return get<{ entries: AuditEntry[]; hasMore: boolean }>(`/api/admin/activity${qs}`, signal);
}

export type ImportRowInput = {
  row: number;
  studentId: string;
  name: string;
  capstone?: string;
  year?: string;
  professor?: string;
  dept?: string;
  email?: string;
  leader?: boolean;
};

export type ImportResult = {
  row: number;
  studentId: string;
  name: string;
  status: "created" | "skipped" | "error";
  message?: string;
  emailed?: boolean;
  /** Only when the credentials email could not be delivered. */
  password?: string;
};

/** Bulk-create student accounts (admin). Send at most 50 rows per call. */
export async function importStudents(rows: ImportRowInput[]): Promise<ImportResult[]> {
  const data = await send<{ results: ImportResult[] }>("/api/admin/users/import", "POST", { rows });
  return data.results;
}

export async function fetchAdminUsers(
  params: { query?: string; role?: string },
  signal?: AbortSignal
): Promise<AdminUserRow[]> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const data = await get<{ users: AdminUserRow[] }>(`/api/admin/users?${sp.toString()}`, signal);
  return data.users;
}

/** Update a member - role / team-leader flag / class / faculty link plus full profile editing (PATCH /api/admin/users, ADMIN only). */
export async function updateAdminUser(payload: {
  id: string;
  role?: string;
  isTeamLeader?: boolean;
  classId?: string;
  /** PROFESSOR only - official university faculty profile link. */
  universityProfileUrl?: string;
  // ----- full "Edit member" fields -----
  displayName?: string;
  username?: string;
  email?: string;
  /** Optional password reset - omitted keeps the current password. */
  password?: string;
  studentId?: string;
  program?: string;
  /** Department code - "" clears the department. */
  dept?: string;
  capstone?: string;
  cohortYear?: string | number;
  professorName?: string;
}): Promise<AdminUserRow> {
  const data = await send<{ user: AdminUserRow }>("/api/admin/users", "PATCH", payload);
  return data.user;
}

export type AdminUserInput = {
  displayName: string;
  /** Optional when studentId is given - the server derives a<studentId>@ks.ac.kr. */
  username?: string;
  /** Optional when studentId is given - the server derives a<studentId>@ks.ac.kr. */
  email?: string;
  password: string;
  role: string;
  dept?: string;
  program?: string;
  studentId?: string;
  classId?: string;
  capstone?: string;
  cohortYear?: number;
  professorName?: string;
  isTeamLeader: boolean;
};

/** Console-only member creation - students key off their student number, staff off a username. */
export async function createAdminUser(payload: AdminUserInput): Promise<AdminUserRow> {
  const data = await send<{ user: AdminUserRow }>("/api/admin/users", "POST", payload);
  return data.user;
}

/** Remove a member - their comments/likes cascade; owned projects survive unowned. */
export async function deleteAdminUser(id: string): Promise<void> {
  await send<{ ok: boolean }>(`/api/admin/users?id=${encodeURIComponent(id)}`, "DELETE");
}

/** Admin audit of every public "forgot password" attempt (ADMIN only). */
export async function fetchAdminPasswordResets(
  signal?: AbortSignal,
  filters: { q?: string; status?: string } = {}
): Promise<PasswordResetRow[]> {
  const sp = new URLSearchParams();
  if (filters.status && filters.status !== "ALL") sp.set("status", filters.status);
  if (filters.q?.trim()) sp.set("q", filters.q.trim());
  const qs = sp.toString() ? `?${sp}` : "";
  const data = await get<{ resets: PasswordResetRow[] }>(`/api/admin/password-resets${qs}`, signal);
  return data.resets;
}

export type AdminPasswordResetResult = {
  ok: true;
  delivered: boolean;
  email: string;
  username: string;
  displayName: string;
  /** Present only when the email could not be delivered. */
  tempPassword?: string;
};

/** One-click reset: new password, saved, emailed (admin only). */
export function adminResetPassword(
  target: { userId: string } | { requestId: string }
): Promise<AdminPasswordResetResult> {
  return send<AdminPasswordResetResult>("/api/admin/password-resets", "POST", target);
}

export function dismissPasswordResetRequest(requestId: string): Promise<{ ok: true }> {
  return send<{ ok: true }>("/api/admin/password-resets", "PATCH", { requestId, status: "DISMISSED" });
}

/**
 * Registered professors for the public request form's picker -
 * every professor account, newest sections included.
 */
export async function fetchProfessorsPublic(signal?: AbortSignal): Promise<SafeUserDTO[]> {
  const data = await get<{ users: SafeUserDTO[] }>(
    "/api/users?role=PROFESSOR&pageSize=100",
    signal
  );
  return data.users;
}

/** Admin email outbox - credentials, password resets and system mail that the platform has "sent". */
export async function fetchAdminEmails(
  kind?: "ALL" | "CREDENTIALS" | "PASSWORD_RESET" | "SYSTEM",
  signal?: AbortSignal,
  filters: { q?: string; status?: string } = {}
): Promise<EmailLogDTO[]> {
  const sp = new URLSearchParams();
  if (kind && kind !== "ALL") sp.set("kind", kind);
  if (filters.status && filters.status !== "ALL") sp.set("status", filters.status);
  if (filters.q?.trim()) sp.set("q", filters.q.trim());
  const qs = sp.toString() ? `?${sp}` : "";
  const data = await get<{ emails: EmailLogDTO[] }>(`/api/admin/emails${qs}`, signal);
  return data.emails;
}

export async function fetchAdminDepartments(signal?: AbortSignal): Promise<AdminDepartmentDTO[]> {
  const data = await get<{ departments: AdminDepartmentDTO[] }>("/api/admin/departments", signal);
  return data.departments;
}

export type AdminDepartmentInput = {
  name: string;
  code: string;
  tagline?: string;
  /** Official department homepage - "" clears it. */
  website?: string | null;
  /** What this faculty calls its capstone course (default "Capstone Design"). */
  capstoneLabel?: string;
  accent?: string;
  sortOrder?: number;
};

export async function createAdminDepartment(
  payload: AdminDepartmentInput
): Promise<AdminDepartmentDTO> {
  const data = await send<{ department: AdminDepartmentDTO }>(
    "/api/admin/departments",
    "POST",
    payload
  );
  return data.department;
}

export async function updateAdminDepartment(
  payload: { id: string } & Partial<AdminDepartmentInput>
): Promise<AdminDepartmentDTO> {
  const data = await send<{ department: AdminDepartmentDTO }>(
    "/api/admin/departments",
    "PATCH",
    payload
  );
  return data.department;
}

export async function deleteAdminDepartment(id: string): Promise<void> {
  await send<{ ok: boolean }>(`/api/admin/departments?id=${encodeURIComponent(id)}`, "DELETE");
}
