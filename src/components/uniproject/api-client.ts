"use client";

// ============================================================
// UniProjects — typed fetch client. THE contract used by all
// views. Backend routes must match these paths + payloads.
// ============================================================

import type {
  AdminDepartmentDTO,
  AdminEventDTO,
  AdminOverviewDTO,
  AdminProjectRow,
  AdminUserRow,
  CommentDTO,
  DepartmentDTO,
  EventDTO,
  JoinRequestDTO,
  NotificationDTO,
  PostDTO,
  ProfileResponse,
  ProjectDetailResponse,
  ProjectListItem,
  ReportDTO,
  SafeUserDTO,
  SearchResults,
  StatsDTO,
  TechnologyDTO,
  UserDirectoryEntry,
  VerificationDTO,
} from "@/lib/types";

export type * from "@/lib/types";

export type View =
  | { name: "home" }
  | { name: "projects"; q?: string; dept?: string; category?: string; year?: number }
  | { name: "project"; slug: string }
  | { name: "community" }
  | { name: "students" }
  | { name: "profile"; username: string }
  | { name: "settings" }
  | { name: "notifications" }
  | { name: "moderation" }
  | { name: "admin" }
  | { name: "create"; editSlug?: string };

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

export async function register(payload: {
  username: string;
  displayName: string;
  email: string;
  password: string;
  verifyToken: string;
}): Promise<SafeUserDTO> {
  const data = await send<{ user: SafeUserDTO }>("/api/auth/register", "POST", payload);
  return data.user;
}

/** Step 1 of the register flow: send a 6-digit code to an education email. */
export async function requestEmailCode(payload: {
  email: string;
}): Promise<{ ok: boolean; devCode: string | null; expiresInMinutes: number; cooldownSeconds: number }> {
  return send("/api/auth/email/request-code", "POST", payload);
}

/** Step 2: confirm the code — returns the single-use token register() requires. */
export async function verifyEmailCode(payload: {
  email: string;
  code: string;
}): Promise<{ ok: boolean; verifyToken: string; expiresInMinutes: number }> {
  return send("/api/auth/email/verify-code", "POST", payload);
}

export async function logout(): Promise<void> {
  await send<{ ok: boolean }>("/api/auth/logout", "POST");
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

export async function fetchEvents(signal?: AbortSignal): Promise<EventDTO[]> {
  const data = await get<{ events: EventDTO[] }>("/api/events", signal);
  return data.events;
}

/** Register a custom tool ("Other") — returns the existing one if the name is already known. */
export async function createTechnology(name: string): Promise<TechnologyDTO> {
  const data = await send<{ technology: TechnologyDTO }>("/api/technologies", "POST", { name });
  return data.technology;
}

// ---------- uploads ----------

export type UploadKind = "avatar" | "cover" | "gallery" | "resource";

/**
 * Upload a file to /api/upload and resolve with its served URL.
 * Uses XHR so callers can render real progress. onProgress gets 0–100.
 */
export function uploadFile(
  file: File,
  kind: UploadKind,
  onProgress?: (pct: number) => void
): Promise<string> {
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

// ---------- verification / moderation ----------

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

// ---------- posts / community ----------

export async function fetchPosts(signal?: AbortSignal): Promise<PostDTO[]> {
  const data = await get<{ posts: PostDTO[] }>("/api/posts", signal);
  return data.posts;
}

export async function createPost(body: string): Promise<PostDTO> {
  const data = await send<{ post: PostDTO }>("/api/posts", "POST", { body });
  return data.post;
}

export async function deletePost(postId: string): Promise<void> {
  await send(`/api/posts/${postId}`, "DELETE");
}

export async function addPostComment(postId: string, body: string): Promise<CommentDTO> {
  const data = await send<{ comment: CommentDTO }>(`/api/posts/${postId}/comments`, "POST", { body });
  return data.comment;
}

// ---------- users ----------

export async function fetchStudents(
  params: Record<string, string | undefined>,
  signal?: AbortSignal
): Promise<UserDirectoryEntry[]> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const data = await get<{ users: UserDirectoryEntry[] }>(`/api/users?${sp.toString()}`, signal);
  return data.users;
}

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

// ---------- admin panel (ADMIN role only — /api/admin/**) ----------

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

export async function updateAdminUserRole(payload: {
  id: string;
  role: string;
}): Promise<AdminUserRow> {
  const data = await send<{ user: AdminUserRow }>("/api/admin/users", "PATCH", payload);
  return data.user;
}

export type AdminUserInput = {
  username: string;
  displayName: string;
  email: string;
  password: string;
  role: string;
  dept?: string;
  program?: string;
};

/** Console-only member creation — mirrors the public register but with a chosen role/dept. */
export async function createAdminUser(payload: AdminUserInput): Promise<AdminUserRow> {
  const data = await send<{ user: AdminUserRow }>("/api/admin/users", "POST", payload);
  return data.user;
}

/** Remove a member — their posts/comments/likes cascade; owned projects survive unowned. */
export async function deleteAdminUser(id: string): Promise<void> {
  await send<{ ok: boolean }>(`/api/admin/users?id=${encodeURIComponent(id)}`, "DELETE");
}

export async function fetchAdminDepartments(signal?: AbortSignal): Promise<AdminDepartmentDTO[]> {
  const data = await get<{ departments: AdminDepartmentDTO[] }>("/api/admin/departments", signal);
  return data.departments;
}

export type AdminDepartmentInput = {
  name: string;
  code: string;
  tagline?: string;
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

export async function fetchAdminEvents(signal?: AbortSignal): Promise<AdminEventDTO[]> {
  const data = await get<{ events: AdminEventDTO[] }>("/api/admin/events", signal);
  return data.events;
}

export type AdminEventInput = {
  title: string;
  description: string;
  location?: string;
  date: string;
};

export async function createAdminEvent(payload: AdminEventInput): Promise<AdminEventDTO> {
  const data = await send<{ event: AdminEventDTO }>("/api/admin/events", "POST", payload);
  return data.event;
}

export async function updateAdminEvent(
  payload: { id: string } & Partial<AdminEventInput>
): Promise<AdminEventDTO> {
  const data = await send<{ event: AdminEventDTO }>("/api/admin/events", "PATCH", payload);
  return data.event;
}

export async function deleteAdminEvent(id: string): Promise<void> {
  await send<{ ok: boolean }>(`/api/admin/events?id=${encodeURIComponent(id)}`, "DELETE");
}
