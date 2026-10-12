// ============================================================
// UniProject — Shared API contract types & domain constants
// Single source of truth for frontend + backend agents.
// ============================================================

// ---------- Domain constants ----------

export type UserRole = 'STUDENT' | 'FACULTY' | 'MODERATOR' | 'UNIVERSITY_ADMIN' | 'PLATFORM_ADMIN'

export const PROJECT_CATEGORIES = [
  'CAPSTONE',
  'GRADUATION_PROJECT',
  'RESEARCH',
  'THESIS',
  'HACKATHON',
  'COURSE_PROJECT',
  'COMPETITION',
  'OTHER',
] as const
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]

export const PROJECT_CATEGORY_LABELS: Record<string, string> = {
  CAPSTONE: 'Capstone',
  GRADUATION_PROJECT: 'Graduation Project',
  RESEARCH: 'Research',
  THESIS: 'Thesis',
  HACKATHON: 'Hackathon',
  COURSE_PROJECT: 'Course Project',
  COMPETITION: 'Competition',
  OTHER: 'Other',
}

export const PROJECT_STATUSES = ['DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'ARCHIVED'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
}

export const VERIFICATION_STATUSES = ['NONE', 'PENDING', 'VERIFIED', 'REJECTED'] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

export const SEMESTERS = ['SPRING', 'SUMMER', 'FALL', 'WINTER'] as const
export const SEMESTER_LABELS: Record<string, string> = {
  SPRING: 'Spring',
  SUMMER: 'Summer',
  FALL: 'Fall',
  WINTER: 'Winter',
}

export const MEMBER_ROLES = ['OWNER', 'LEAD', 'DEVELOPER', 'DESIGNER', 'RESEARCHER', 'CONTRIBUTOR', 'MEMBER'] as const
export type MemberRole = (typeof MEMBER_ROLES)[number]
export const MEMBER_ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  LEAD: 'Team Lead',
  DEVELOPER: 'Developer',
  DESIGNER: 'Designer',
  RESEARCHER: 'Researcher',
  CONTRIBUTOR: 'Contributor',
  MEMBER: 'Member',
}

export const RESOURCE_TYPES = ['SCREENSHOT', 'DOCUMENT', 'GITHUB', 'DEMO', 'VIDEO', 'PRESENTATION', 'OTHER'] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]

export const POST_TYPES = ['GENERAL', 'QUESTION', 'IDEA', 'TEAMMATE_REQUEST', 'RESOURCE_SHARE', 'EVENT', 'PROJECT_UPDATE'] as const
export type PostType = (typeof POST_TYPES)[number]
export const POST_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'General',
  QUESTION: 'Question',
  IDEA: 'Idea',
  TEAMMATE_REQUEST: 'Looking for teammates',
  RESOURCE_SHARE: 'Resource sharing',
  EVENT: 'Event',
  PROJECT_UPDATE: 'Project update',
}

export const REPORT_REASONS = ['SPAM', 'INAPPROPRIATE', 'INACCURATE', 'COPYRIGHT', 'IMPERSONATION', 'OTHER'] as const
export const REPORT_REASON_LABELS: Record<string, string> = {
  SPAM: 'Spam',
  INAPPROPRIATE: 'Inappropriate',
  INACCURATE: 'Inaccurate',
  COPYRIGHT: 'Copyright',
  IMPERSONATION: 'Impersonation',
  OTHER: 'Other',
}

export const TECHNOLOGY_CATEGORIES = ['LANGUAGE', 'FRAMEWORK', 'TOOL', 'DATABASE', 'AI_ML', 'DESIGN', 'OTHER'] as const
export const TECHNOLOGY_CATEGORY_LABELS: Record<string, string> = {
  LANGUAGE: 'Languages',
  FRAMEWORK: 'Frameworks',
  TOOL: 'Tools',
  DATABASE: 'Databases',
  AI_ML: 'AI / ML',
  DESIGN: 'Design',
  OTHER: 'Other',
}

// ---------- Shared entities ----------

export interface University {
  id: string
  name: string
  slug: string
  description?: string | null
  website?: string | null
  _count?: { departments: number; projects: number; users: number }
}

export interface Department {
  id: string
  universityId: string
  name: string
  slug: string
  description?: string | null
  university?: University
  _count?: { projects: number; users: number }
}

export interface Technology {
  id: string
  name: string
  slug: string
  category: string
}

export interface UserPublic {
  id: string
  username: string
  displayName: string
  avatarUrl?: string | null
  role: string
  university?: { id: string; name: string } | null
  department?: { id: string; name: string } | null
}

export interface UserCard extends UserPublic {
  program?: string | null
  bio?: string | null
  skills?: string | null
  lookingForTeammates?: boolean
  _count?: { projects: number; posts: number; followers: number }
}

export interface UserProfile extends UserCard {
  email?: string // only for self
  website?: string | null
  github?: string | null
  profileVisibility?: string
  createdAt?: string
  isSelf?: boolean
  isFollowing?: boolean
}

export interface ProjectMemberData {
  id: string
  role: string
  membershipStatus: string
  joinedAt: string
  userId: string
  user: UserPublic
}

export interface ProjectCard {
  id: string
  slug: string
  title: string
  shortDescription: string
  coverUrl?: string | null
  category: string
  year?: number | null
  semester?: string | null
  status: string
  verificationStatus: string
  views: number
  createdAt: string
  publishedAt?: string | null
  university?: { id: string; name: string; slug: string } | null
  department?: { id: string; name: string; slug: string } | null
  technologies: { id: string; name: string; slug: string }[]
  members: { userId: string; displayName: string; username: string; avatarUrl?: string | null; role: string }[]
  _count?: { comments: number; bookmarks: number }
  isOwner?: boolean
  viewerRole?: string | null
}

export interface ResourceData {
  id: string
  type: string
  title: string
  url: string
  description?: string | null
  createdAt: string
}

export interface TimelineData {
  id: string
  title: string
  description?: string | null
  eventDate: string
}

export interface CommentData {
  id: string
  body: string
  createdAt: string
  status: string
  author: UserPublic
}

export interface ProjectDetail extends Omit<ProjectCard, 'members'> {
  description?: string | null
  program?: string | null
  supervisorName?: string | null
  allowJoinRequests: boolean
  lookingForTeammates: boolean
  updatedAt: string
  members: ProjectMemberData[]
  resources: ResourceData[]
  timeline: TimelineData[]
  comments: CommentData[]
  owner?: UserPublic
}

export interface ProjectViewerContext {
  isOwner: boolean
  isMember: boolean
  role: string | null
  membershipStatus: string | null
  bookmarked: boolean
  following: boolean
  joinRequestStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null
}

export interface PostData {
  id: string
  type: string
  title?: string | null
  body: string
  status: string
  createdAt: string
  author: UserPublic
  project?: { id: string; slug: string; title: string; coverUrl?: string | null; category: string } | null
  comments: CommentData[]
  likeCount: number
  likedByViewer: boolean
}

export interface EventData {
  id: string
  title: string
  description?: string | null
  startAt: string
  endAt?: string | null
  location?: string | null
  url?: string | null
  organizer: UserPublic
  university?: { id: string; name: string } | null
}

export interface NotificationData {
  id: string
  type: string
  title: string
  body?: string | null
  link?: string | null
  read: boolean
  createdAt: string
}

export interface JoinRequestData {
  id: string
  status: string
  message?: string | null
  createdAt: string
  user: UserPublic
}

export interface VerificationItem {
  id: string
  status: string
  note?: string | null
  createdAt: string
  reviewedAt?: string | null
  project: { id: string; slug: string; title: string; coverUrl?: string | null; university?: { name: string } | null; department?: { name: string } | null; verificationStatus: string }
}

export interface ReportItem {
  id: string
  targetType: string
  targetId: string
  reason: string
  details?: string | null
  status: string
  resolutionNote?: string | null
  createdAt: string
  resolvedAt?: string | null
  reporter: UserPublic
  targetPreview?: {
    title: string
    snippet?: string
    authorName?: string
    exists: boolean
    slug?: string | null
  } | null
}

export interface SearchResults {
  projects: ProjectCard[]
  users: UserCard[]
  universities: University[]
  technologies: Technology[]
}

export interface PlatformStats {
  projects: number
  students: number
  universities: number
  departments: number
  posts: number
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// ---------- API response envelopes ----------

export interface AuthUser {
  user: UserProfile
}

export type ProjectsListResponse = Paginated<ProjectCard>

export type PostsListResponse = Paginated<PostData>

export interface MeProjectsResponse {
  projects: ProjectCard[]
}

export interface BookmarksResponse {
  projects: ProjectCard[]
  posts: PostData[]
}

export interface FollowingResponse {
  users: UserCard[]
  projects: ProjectCard[]
}

export interface NotificationsResponse {
  notifications: NotificationData[]
  unread: number
}

// ---------- API request bodies ----------

export interface RegisterBody {
  username: string
  displayName: string
  email: string
  password: string
  universityId?: string
  departmentId?: string
  program?: string
}

export interface LoginBody {
  identifier: string // username or email
  password: string
}

export interface UpdateProfileBody {
  displayName?: string
  bio?: string
  avatarUrl?: string
  program?: string
  skills?: string
  website?: string
  github?: string
  universityId?: string
  departmentId?: string
  profileVisibility?: 'PUBLIC' | 'UNIVERSITY' | 'PRIVATE'
  lookingForTeammates?: boolean
}

export interface CreateProjectBody {
  title: string
  shortDescription: string
  description?: string
  coverUrl?: string
  universityId?: string
  departmentId?: string
  category: string
  year?: number
  semester?: string
  program?: string
  supervisorName?: string
  technologyIds?: string[]
  technologyNames?: string[] // create-or-connect by name
  members?: { username: string; role?: string }[]
  resources?: { type: string; title: string; url: string; description?: string }[]
  timeline?: { title: string; description?: string; eventDate: string }[]
  allowJoinRequests?: boolean
  lookingForTeammates?: boolean
  publish?: boolean
}

export interface UpdateProjectBody extends Partial<CreateProjectBody> {
  status?: string
  requestVerification?: boolean
}

// ---------- Navigation (hash routes) ----------

export type HashRoute =
  | { view: 'landing' }
  | { view: 'explore'; query?: string }
  | { view: 'projects' }
  | { view: 'students' }
  | { view: 'community'; tab?: string }
  | { view: 'project'; slug: string }
  | { view: 'profile'; username: string }
  | { view: 'create-project' }
  | { view: 'edit-project'; slug: string }
  | { view: 'library' }
  | { view: 'moderation'; tab?: string }
  | { view: 'settings' }

export function parseHash(hash: string): HashRoute {
  const clean = hash.replace(/^#\/?/, '')
  const [path, queryString] = clean.split('?')
  const segments = path.split('/').filter(Boolean)
  const params = new URLSearchParams(queryString || '')

  if (segments.length === 0) return { view: 'landing' }
  switch (segments[0]) {
    case 'explore':
      return { view: 'explore', query: params.get('q') || undefined }
    case 'projects':
      return { view: 'projects' }
    case 'students':
      return { view: 'students' }
    case 'community':
      return { view: 'community', tab: segments[1] || params.get('tab') || undefined }
    case 'p':
      return { view: 'project', slug: segments[1] || '' }
    case 'u':
      return { view: 'profile', username: segments[1] || '' }
    case 'create':
      return { view: 'create-project' }
    case 'edit':
      return { view: 'edit-project', slug: segments[1] || '' }
    case 'library':
      return { view: 'library' }
    case 'moderation':
      return { view: 'moderation', tab: segments[1] || undefined }
    case 'settings':
      return { view: 'settings' }
    default:
      return { view: 'landing' }
  }
}

export function routeToHash(route: HashRoute): string {
  switch (route.view) {
    case 'landing':
      return '#/'
    case 'explore':
      return route.query ? `#/explore?q=${encodeURIComponent(route.query)}` : '#/explore'
    case 'projects':
      return '#/projects'
    case 'students':
      return '#/students'
    case 'community':
      return route.tab ? `#/community/${route.tab}` : '#/community'
    case 'project':
      return `#/p/${route.slug}`
    case 'profile':
      return `#/u/${route.username}`
    case 'create-project':
      return '#/create'
    case 'edit-project':
      return `#/edit/${route.slug}`
    case 'library':
      return '#/library'
    case 'moderation':
      return route.tab ? `#/moderation/${route.tab}` : '#/moderation'
    case 'settings':
      return '#/settings'
    default:
      return '#/'
  }
}
