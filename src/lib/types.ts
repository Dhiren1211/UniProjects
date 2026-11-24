// ============================================================
// UniProjects - shared API payload types (the contract between
// backend route handlers and frontend views).
// ============================================================

// Role hierarchy (highest → lowest). VISITOR = unauthenticated.
export type Role = "ADMIN" | "MODERATOR" | "PROFESSOR" | "STUDENT";

export type DepartmentDTO = {
  id: string;
  name: string;
  code: string;
  tagline: string | null;
  website: string | null; // official department homepage - admin-managed
  capstoneLabel: string; // what this faculty calls its capstone course (default "Capstone Design")
  accent: string;
  projectCount?: number;
};

export type SafeUserDTO = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  studentId: string | null;
  classId: string | null;
  capstone: string | null;
  cohortYear: number | null;
  professorName: string | null;
  isTeamLeader: boolean;
  bio: string | null;
  avatarUrl: string | null;
  program: string | null;
  skills: string[];
  website: string | null;
  github: string | null;
  universityProfileUrl: string | null; // PROFESSOR only - official university faculty profile
  lookingForTeammates: boolean;
  department: { id: string; name: string; code: string; accent: string; capstoneLabel: string } | null;
  createdAt: string;
};

export type MemberDTO = {
  id: string;
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  role: string; // OWNER | LEAD | MEMBER
  departmentCode?: string | null;
};

export type TechnologyDTO = {
  id: string;
  name: string;
  slug: string;
  category: string;
};

export type ResourceDTO = {
  id: string;
  type: string; // DEMO | GITHUB | DOCUMENT | VIDEO | PRESENTATION
  label: string;
  url: string; // https://… link or /uploads/... uploaded file
};

export type TimelineDTO = {
  id: string;
  title: string;
  date: string;
  note: string | null;
};

export type CommentDTO = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; username: string; displayName: string; role: string; avatarUrl?: string | null };
};

export type ProjectListItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  coverImage: string | null;
  category: string;
  year: number;
  semester: string;
  supervisor: string | null;
  classId: string | null;
  tags: string[];
  demoUrl: string | null;
  repoUrl: string | null;
  featured: boolean;
  verified: boolean;
  status: string; // DRAFT | PENDING | PUBLISHED | REJECTED
  lookingForTeammates: boolean;
  views: number;
  createdAt: string;
  department: DepartmentDTO;
  members: MemberDTO[];
  technologies: TechnologyDTO[];
  likeCount: number;
};

export type ProjectDetail = ProjectListItem & {
  description: string;
  program: string | null;
  allowJoinRequests: boolean;
  resources: ResourceDTO[];
  galleryImages: string[]; // ordered project photos, shown as a slider
  timeline: TimelineDTO[];
  comments: CommentDTO[];
  ownerId: string | null;
  /** Username of the PROFESSOR account whose displayName matches the supervisor string (null when unmatched). */
  supervisorUsername: string | null;
  /** Reviewer's note when changes were requested (status REJECTED). */
  reviewNote: string | null;
  submittedAt: string | null;
};

export type ViewerDTO = {
  user: SafeUserDTO | null;
  isOwner: boolean;
  isMember: boolean;
  bookmarked: boolean;
  following: boolean;
  liked: boolean;
  joinRequestStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  canVerify: boolean;
  /** Admin or this project's professor - may approve it for publication. */
  canReview: boolean;
  /** The open verification request, shown to the reviewer on the project page. */
  pendingVerification: { id: string; requester: string; createdAt: string } | null; // staff and project not yet verified
};

export type ProjectDetailResponse = {
  project: ProjectDetail;
  viewer: ViewerDTO;
};

export type JoinRequestDTO = {
  id: string;
  status: string;
  message: string | null;
  createdAt: string;
  user: { id: string; username: string; displayName: string; role: string; avatarUrl?: string | null };
};

export type VerificationDTO = {
  id: string;
  projectId: string;
  status: string;
  createdAt: string;
  requester: { id: string; username: string; displayName: string };
  project: { slug: string; title: string };
};

export type ReportDTO = {
  id: string;
  targetType: string; // PROJECT | USER
  targetId: string;
  reason: string;
  status: string; // OPEN | RESOLVED
  createdAt: string;
  reporter: { id: string; username: string; displayName: string };
  targetLabel: string;
  targetSlug?: string | null;
};

export type NotificationDTO = {
  id: string;
  type: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export type StatsDTO = {
  projects: number;
  departments: number;
  students: number;
  featured: number;
  verified: number;
  latestYear: number | null;
};

export type SearchResults = {
  projects: ProjectListItem[];
  users: SafeUserDTO[];
};

export type UserDirectoryEntry = SafeUserDTO & {
  projectCount: number;
};

export type ProfileResponse = {
  user: SafeUserDTO;
  projects: ProjectListItem[];
  followerCount: number;
  followingCount: number;
  viewerFollows: boolean;
};

// ===== Site settings (public contract) =====

export type SiteSettings = {
  searchEnabled: boolean;
  accountRequestsOpen: boolean;
  siteName: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
};

// ===== Account requests (public intake → admin approval) =====

export type AccountRequestDTO = {
  id: string;
  role: "STUDENT" | "PROFESSOR";
  studentId: string | null; // students only
  email: string | null; // professors only
  name: string;
  capstone: string | null; // I | II | III - students only
  year: number | null; // students only
  professor: string | null; // students only
  status: "PENDING" | "APPROVED" | "REJECTED";
  decisionNote: string | null;
  classId: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  createdAt: string;
};

/** Returned by the approval endpoint - powers the credentials popup. */
export type ApprovalResultDTO = {
  request: AccountRequestDTO;
  account: {
    userId: string; // login name (the student number)
    displayName: string;
    email: string;
    classId: string;
    temporaryPassword: string;
  };
  emailLogId: string;
  /** Whether the credentials email was delivered. */
  emailed?: boolean;
};

export type AnnouncementDTO = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmailLogDTO = {
  id: string;
  to: string;
  subject: string;
  body: string;
  kind: string; // CREDENTIALS | PASSWORD_RESET | SYSTEM
  status: string; // SENT | CONSOLE
  createdAt: string;
};

/** One public "forgot password" attempt, as shown in the admin Resets tab. */
export type PasswordResetRow = {
  id: string;
  email: string;
  status: "SENT" | "PENDING" | "NOT_FOUND" | "DISMISSED";
  createdAt: string;
  /** The account the request matched (null for NOT_FOUND rows). */
  user: { id: string; username: string; displayName: string; role: string } | null;
};

// ===== Admin panel =====

export type AdminOverviewDTO = {
  users: number;
  students: number;
  professors: number;
  moderators: number;
  projects: number;
  published: number;
  drafts: number;
  featured: number;
  verified: number;
  departments: number;
  comments: number;
  resources: number;
  totalViews: number;
  pendingVerifications: number;
  openReports: number;
  pendingJoinRequests: number;
  pendingAccountRequests: number;
  /** Projects waiting for approval. */
  pendingProjectReviews: number;
  /** Forgot-password requests waiting for an admin. */
  pendingPasswordResets: number;
  byCategory: { category: string; count: number }[];
  byDepartment: { code: string; name: string; accent: string; count: number }[];
  byClass: { classId: string; students: number; projects: number }[];
  recentProjects: ProjectListItem[];
  recentUsers: {
    id: string;
    username: string;
    displayName: string;
    role: string;
    avatarUrl: string | null;
    createdAt: string;
  }[];
  // Control-center additions: live activity stream + storage footprint.
  activity: AdminActivityItem[];
  storage: { uploadedFiles: number; linkedResources: number; uploadedResources: number; galleryImages: number };
  signupsByMonth: { month: string; count: number }[];
};

export type AdminActivityItem = {
  id: string;
  kind: "PROJECT" | "USER" | "COMMENT" | "REPORT" | "JOIN" | "ACCOUNT_REQUEST" | "RESOURCE";
  text: string;
  detail?: string | null;
  createdAt: string;
  href?: string | null;
};

export type AdminProjectRow = ProjectListItem & {
  commentCount: number;
  resourceCount: number;
  hasSourceLink: boolean;
  hasCover: boolean;
};

export type AdminUserRow = SafeUserDTO & {
  projectCount: number;
  classmateCount: number;
};

// Admin console extra: the admin departments CRUD needs the
// manual sort order for its edit form - DepartmentDTO intentionally omits it.
export type AdminDepartmentDTO = DepartmentDTO & { sortOrder: number };
