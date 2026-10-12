// ============================================================
// UniProjects — shared API payload types (the contract between
// backend route handlers and frontend views).
// ============================================================

export type Role = "STUDENT" | "FACULTY" | "ADMIN";

export type DepartmentDTO = {
  id: string;
  name: string;
  code: string;
  tagline: string | null;
  accent: string;
  projectCount?: number;
};

export type SafeUserDTO = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  bio: string | null;
  avatarUrl: string | null;
  program: string | null;
  skills: string[];
  website: string | null;
  github: string | null;
  lookingForTeammates: boolean;
  department: { id: string; name: string; code: string; accent: string } | null;
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
  tags: string[];
  demoUrl: string | null;
  repoUrl: string | null;
  featured: boolean;
  verified: boolean;
  status: string; // DRAFT | PUBLISHED
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
};

export type ViewerDTO = {
  user: SafeUserDTO | null;
  isOwner: boolean;
  isMember: boolean;
  bookmarked: boolean;
  following: boolean;
  liked: boolean;
  joinRequestStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  canVerify: boolean; // staff and project not yet verified
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
  targetType: string; // PROJECT | POST | USER
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

export type PostDTO = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; username: string; displayName: string; role: string; avatarUrl?: string | null; departmentCode?: string | null };
  likeCount: number;
  liked: boolean;
  bookmarked: boolean;
  commentCount: number;
  comments: CommentDTO[];
};

export type EventDTO = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  date: string;
};

export type StatsDTO = {
  projects: number;
  departments: number;
  students: number;
  featured: number;
  verified: number;
  posts: number;
  latestYear: number | null;
};

export type SearchResults = {
  projects: ProjectListItem[];
  users: SafeUserDTO[];
  posts: PostDTO[];
};

export type UserDirectoryEntry = SafeUserDTO & {
  projectCount: number;
};

export type ProfileResponse = {
  user: SafeUserDTO;
  projects: ProjectListItem[];
  posts: PostDTO[];
  followerCount: number;
  followingCount: number;
  viewerFollows: boolean;
};

// ===== Admin panel (ADMIN role only) =====

export type AdminOverviewDTO = {
  users: number;
  students: number;
  faculty: number;
  projects: number;
  published: number;
  drafts: number;
  featured: number;
  verified: number;
  departments: number;
  events: number;
  posts: number;
  comments: number;
  resources: number;
  totalViews: number;
  pendingVerifications: number;
  openReports: number;
  pendingJoinRequests: number;
  byCategory: { category: string; count: number }[];
  byDepartment: { code: string; name: string; accent: string; count: number }[];
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
  kind: "PROJECT" | "USER" | "POST" | "COMMENT" | "REPORT" | "JOIN" | "EVENT" | "RESOURCE";
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
  postCount: number;
};

export type AdminEventDTO = EventDTO & { createdAt: string };

// Admin console extra (task 2-c): the admin departments CRUD needs the
// manual sort order for its edit form — DepartmentDTO intentionally omits it.
export type AdminDepartmentDTO = DepartmentDTO & { sortOrder: number };
