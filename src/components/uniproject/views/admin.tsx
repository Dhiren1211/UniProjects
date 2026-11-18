"use client";

// ============================================================
// Admin control-center console (ADMIN full / MODERATOR limited).
// Two-column shell on ≥ lg: sticky sidebar (grouped nav, system
// status, back-to-site) + per-tab content with its own header.
// Below lg the sidebar collapses into a top bar with pills.
// Tabs - ADMIN: overview · approvals · users · projects ·
// announcements · moderation · emails · settings · departments.
// MODERATOR: overview · users (read-only) · projects ·
// announcements · moderation. Data flows through /api/admin/**
// and the staff endpoints via api-client.ts.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { format } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Dices,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  FolderKanban,
  GraduationCap,
  Handshake,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Loader2,
  ImageUp,
  Lock,
  Mail,
  Megaphone,
  MessageCircle,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ACCENTS, UNIVERSITY, accentOf } from "@/lib/config";
import { cn } from "@/lib/utils";
import {
  adminResetPassword,
  dismissPasswordResetRequest,
  type AdminPasswordResetResult,
  createAdminDepartment,
  createAdminUser,
  createAnnouncement,
  decideAccountRequest,
  decideVerification,
  deleteAccountRequest,
  deleteAdminDepartment,
  deleteAdminProject,
  deleteAdminUser,
  deleteAnnouncement,
  fetchAccountRequests,
  fetchAdminDepartments,
  fetchAdminEmails,
  fetchAdminOverview,
  fetchAdminPasswordResets,
  fetchAdminProjects,
  fetchAdminUsers,
  fetchAnnouncements,
  fetchProfessorsPublic,
  fetchReports,
  fetchSettings,
  fetchVerifications,
  resolveReport,
  updateAdminDepartment,
  updateAdminProject,
  updateAdminUser,
  updateAnnouncement,
  updateSiteSettings,
  uploadFile,
  type Navigate,
  type View,
} from "../api-client";
import { useAppStore } from "../store";
import { deleteWithUndo, restoreAt } from "../undo-delete";
import { ApprovalQueueCard, ReportsQueueCard, VerificationQueueCard } from "../staff-queues";
import {
  CategoryIcon,
  DeptDot,
  EmptyState,
  StaffBadge,
  StatusBadge,
  UserAvatar,
  formatViews,
  statusLabel,
  timeAgo,
} from "../ui-bits";
import type {
  AccountRequestDTO,
  AdminActivityItem,
  AdminDepartmentDTO,
  AdminOverviewDTO,
  AdminProjectRow,
  AdminUserRow,
  AnnouncementDTO,
  ApprovalResultDTO,
  EmailLogDTO,
  PasswordResetRow,
  ProjectListItem,
  DepartmentDTO,
  SafeUserDTO,
  SiteSettings,
} from "@/lib/types";

type TabKey =
  | "overview"
  | "approvals"
  | "resets"
  | "users"
  | "projects"
  | "announcements"
  | "moderation"
  | "emails"
  | "settings"
  | "departments";

/** Every console tab in display order - adminOnly ones are hidden from moderators. */
const ALL_TABS: { key: TabKey; label: string; icon: LucideIcon; adminOnly?: boolean }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "approvals", label: "Approvals", icon: ListChecks, adminOnly: true },
  { key: "users", label: "Users", icon: Users },
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "announcements", label: "Announcements", icon: Megaphone },
  { key: "moderation", label: "Moderation", icon: ShieldCheck },
  { key: "resets", label: "Resets", icon: KeyRound, adminOnly: true },
  { key: "emails", label: "Emails", icon: Mail, adminOnly: true },
  { key: "settings", label: "Settings", icon: Settings2, adminOnly: true },
  { key: "departments", label: "Departments", icon: Building2, adminOnly: true },
];

function tabsForRole(role: string | undefined) {
  return role === "ADMIN" ? ALL_TABS : ALL_TABS.filter((t) => !t.adminOnly);
}

/** Per-tab content header copy. */
const TAB_META: Record<TabKey, { title: string; description: string }> = {
  overview: {
    title: "Overview",
    description: "Live health of the showcase - traffic, content and safety queues at a glance.",
  },
  approvals: {
    title: "Account requests",
    description:
      "Approve or reject student intake - approval provisions the account and emails the credentials.",
  },
  resets: {
    title: "Password resets",
    description:
      "Every public \u201cforgot password\u201d request - matched accounts received a temporary password by email.",
  },
  users: {
    title: "Users",
    description: "Roles, sections and team leaders across the university directory.",
  },
  projects: {
    title: "Projects",
    description: "Feature, publish or remove any project across the campus showcase.",
  },
  announcements: {
    title: "Announcements",
    description: "Campus-wide news, published to the public Announcements page.",
  },
  moderation: {
    title: "Moderation",
    description: "Verification requests and open community reports awaiting review.",
  },
  emails: {
    title: "Email outbox",
    description: "Every transactional email the platform has sent - credentials and system mail.",
  },
  settings: {
    title: "Site settings",
    description: "Feature toggles and hero copy - changes apply across the whole site.",
  },
  departments: {
    title: "Departments",
    description: "Structure the catalogue - departments power filters and project grouping.",
  },
};

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Student",
  PROFESSOR: "Professor",
  MODERATOR: "Moderator",
  ADMIN: "Admin",
};

const ACTIVITY_ICONS: Record<AdminActivityItem["kind"], LucideIcon> = {
  PROJECT: FolderKanban,
  USER: UserPlus,
  COMMENT: MessageCircle,
  REPORT: Flag,
  JOIN: Handshake,
  ACCOUNT_REQUEST: UserPlus,
  RESOURCE: Paperclip,
};

/** "/project/<slug>" → internal view, anything else is not navigable. */
function activityToView(href: string): View | null {
  const project = /^\/project\/([^/?#]+)/.exec(href);
  if (project) return { name: "project", slug: project[1] };
  return null;
}

/** "2025-11" → "Nov". */
function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const idx = Number(month) - 1;
  if (!year || !Number.isFinite(idx) || idx < 0 || idx > 11) return key;
  return format(new Date(Number(year), idx, 1), "MMM");
}

/** value → debounced value (300 ms) - keeps search/filters off the network until typing settles. */
function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ============================================================
// AdminView - guard + console shell + tab routing
// ============================================================

export function AdminView({ navigate, initialTab }: { navigate: Navigate; initialTab?: string }) {
  const { user, authLoaded, openAuth } = useAppStore();
  const reduceMotion = useReducedMotion();
  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "ADMIN" || user?.role === "MODERATOR";
  const [overview, setOverview] = useState<AdminOverviewDTO | null>(null);
  const [overviewError, setOverviewError] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Partial<Record<TabKey, number>>>({});
  const [arriveNew, setArriveNew] = useState(false);

  // tabs this role may open - used to validate deep-links and render the nav
  const navItems = useMemo(() => tabsForRole(user?.role), [user?.role]);
  const initialTabValid = !!initialTab && navItems.some((t) => t.key === initialTab);

  const [tab, setTab] = useState<TabKey>(initialTabValid ? (initialTab as TabKey) : "overview");

  // honor a deep-linked tab ("Review account requests" → approvals, …) on arrival.
  // Adjust-during-render pattern: resets state when the prop changes without an effect.
  const [seenInitialTab, setSeenInitialTab] = useState(initialTab);
  if (initialTab !== seenInitialTab) {
    setSeenInitialTab(initialTab);
    if (initialTabValid && initialTab) setTab(initialTab as TabKey);
  }

  // Keep the "Updated …" captions honest without refetching anything.
  const [, setClock] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setClock((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  /** Record a finished load: always stops the spinner; timestamps only on success. */
  const noteLoaded = useCallback((keys: TabKey[], ok: boolean) => {
    setRefreshing(false);
    if (!ok) return;
    const at = Date.now();
    setLoadedAt((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = at;
      return next;
    });
  }, []);

  // Stable per-tab onLoaded callbacks - tabs include them in their fetch-effect
  // deps, so a fresh identity per render would trigger a refetch loop.
  const overviewLoaded = useCallback(
    (ok: boolean) => noteLoaded(["overview", "moderation"], ok),
    [noteLoaded]
  );
  const projectsLoaded = useCallback((ok: boolean) => noteLoaded(["projects"], ok), [noteLoaded]);
  const usersLoaded = useCallback((ok: boolean) => noteLoaded(["users"], ok), [noteLoaded]);
  const approvalsLoaded = useCallback((ok: boolean) => noteLoaded(["approvals"], ok), [noteLoaded]);
  const resetsLoaded = useCallback((ok: boolean) => noteLoaded(["resets"], ok), [noteLoaded]);
  const announcementsLoaded = useCallback(
    (ok: boolean) => noteLoaded(["announcements"], ok),
    [noteLoaded]
  );
  const emailsLoaded = useCallback((ok: boolean) => noteLoaded(["emails"], ok), [noteLoaded]);
  const settingsLoaded = useCallback((ok: boolean) => noteLoaded(["settings"], ok), [noteLoaded]);
  const departmentsLoaded = useCallback(
    (ok: boolean) => noteLoaded(["departments"], ok),
    [noteLoaded]
  );

  /** Explicit refresh from the content header - spins the button until data lands. */
  const refresh = () => {
    setRefreshing(true);
    setRefreshTick((n) => n + 1);
  };

  /** Background re-sync of shared overview data after a mutation (no spinner). */
  const syncOverview = () => setRefreshTick((n) => n + 1);

  /** Switch tabs; quick actions can request the tab's "New …" dialog to open on arrival. */
  const goTab = (key: TabKey, openNew = false) => {
    setTab(key);
    setArriveNew(openNew);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    if (!authLoaded || !isStaff) return;
    let cancelled = false;
    fetchAdminOverview()
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setOverviewError(false);
        overviewLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setOverviewError(true);
        overviewLoaded(false);
        toast.error(e instanceof Error ? e.message : "Could not load the admin overview");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick, authLoaded, isStaff, overviewLoaded]);

  // ---------- gates ----------

  if (!authLoaded) {
    return (
      <Shell>
        <div className="space-y-6">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  if (!user || !isStaff) {
    return (
      <Shell>
        <EmptyState
          icon={user ? ShieldAlert : Lock}
          title="Staff only"
          hint="This console manages the showcase - account requests, members, projects and site settings. It is limited to administrators and moderators."
          action={
            !user ? (
              <Button onClick={() => openAuth("login")} className="rounded-xl font-semibold">
                Sign in
              </Button>
            ) : undefined
          }
        />
      </Shell>
    );
  }

  const moderationPending = (overview?.pendingVerifications ?? 0) + (overview?.openReports ?? 0);
  const approvalsPending = isAdmin ? (overview?.pendingAccountRequests ?? 0) : 0;
  const meta = TAB_META[tab];

  return (
    <div className="lg:flex">
      <ConsoleSidebar
        tab={tab}
        items={navItems}
        moderationPending={moderationPending}
        approvalsPending={approvalsPending}
        onTab={goTab}
        navigate={navigate}
      />

      <main className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">
          {/* < lg: brand + scrollable pills replace the sidebar */}
          <ConsoleTopBar
            tab={tab}
            items={navItems}
            moderationPending={moderationPending}
            approvalsPending={approvalsPending}
            user={user}
            onTab={goTab}
          />

          {/* < lg: the sidebar system mini-card lives at the top of Overview */}
          {tab === "overview" && overview ? (
            <SystemMiniCard storage={overview.storage} className="mt-4 lg:hidden" />
          ) : null}

          <ContentHeader
            title={meta.title}
            description={meta.description}
            loadedAt={loadedAt[tab]}
            refreshing={refreshing}
            onRefresh={refresh}
            className="mt-5"
          />

          {/* ---------- active tab ---------- */}
          <div className="mt-4">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
            {tab === "overview" ? (
              <OverviewTab
                overview={overview}
                error={overviewError}
                onRetry={refresh}
                navigate={navigate}
                onQuickAction={goTab}
                isAdmin={isAdmin}
              />
            ) : null}
            {isAdmin && tab === "approvals" ? (
              <ApprovalsTab
                onChanged={syncOverview}
                refreshTick={refreshTick}
                onLoaded={approvalsLoaded}
              />
            ) : null}
            {tab === "projects" ? (
              <ProjectsTab
                navigate={navigate}
                onChanged={syncOverview}
                refreshTick={refreshTick}
                onLoaded={projectsLoaded}
              />
            ) : null}
            {tab === "users" ? (
              <UsersTab
                navigate={navigate}
                onChanged={syncOverview}
                refreshTick={refreshTick}
                onLoaded={usersLoaded}
                autoOpenNew={arriveNew}
                readOnly={!isAdmin}
              />
            ) : null}
            {tab === "announcements" ? (
              <AnnouncementsTab
                onChanged={syncOverview}
                refreshTick={refreshTick}
                onLoaded={announcementsLoaded}
              />
            ) : null}
            {tab === "moderation" ? <ModerationTab overview={overview} navigate={navigate} /> : null}
            {isAdmin && tab === "emails" ? (
              <EmailsTab refreshTick={refreshTick} onLoaded={emailsLoaded} />
            ) : null}
            {isAdmin && tab === "resets" ? (
              <ResetsTab refreshTick={refreshTick} onLoaded={resetsLoaded} />
            ) : null}
            {isAdmin && tab === "settings" ? (
              <SettingsTab refreshTick={refreshTick} onLoaded={settingsLoaded} />
            ) : null}
            {isAdmin && tab === "departments" ? (
              <DepartmentsTab
                onChanged={syncOverview}
                refreshTick={refreshTick}
                onLoaded={departmentsLoaded}
                autoOpenNew={arriveNew}
              />
            ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
      </main>
    </div>
  );
}

/** Simple centered container for the auth gates. */
function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-5 py-10 pb-20 md:px-8 md:py-12">{children}</div>;
}

// ============================================================
// Console chrome - sidebar (≥ lg), top bar (< lg), header, cards
// ============================================================

function ConsoleSidebar({
  tab,
  items,
  moderationPending,
  approvalsPending,
  onTab,
  navigate,
}: {
  tab: TabKey;
  items: typeof ALL_TABS;
  moderationPending: number;
  approvalsPending: number;
  onTab: (key: TabKey, openNew?: boolean) => void;
  navigate: Navigate;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <aside
      className="sticky top-[65px] hidden h-[calc(100vh-65px)] w-52 shrink-0 flex-col overflow-hidden border-r border-up-border bg-card lg:flex"
      aria-label="Admin console"
    >
      {/* flat minimal nav - no brand header, no counters, no chrome */}
      <nav
        aria-label="Admin sections"
        className="scrollbar-none relative min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="space-y-0.5">
          {items.map((item) => {
            const active = tab === item.key;
            const Icon = item.icon;
            const pending =
              item.key === "moderation"
                ? moderationPending
                : item.key === "approvals"
                  ? approvalsPending
                  : 0;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTab(item.key)}
                aria-current={active ? "page" : undefined}
                aria-label={pending > 0 ? `${item.label} - ${pending} pending` : undefined}
                className={cn(
                  "relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "text-primary-700"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="console-nav-pill"
                    aria-hidden
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 420, damping: 34 }
                    }
                    className="absolute inset-0 rounded-lg bg-primary-50"
                  />
                ) : null}
                <Icon
                  className={cn(
                    "relative size-4 shrink-0 transition-colors",
                    active && "text-primary-700"
                  )}
                  aria-hidden
                />
                <span className="relative min-w-0 flex-1 truncate text-left">{item.label}</span>
                {pending > 0 ? (
                  <span
                    aria-hidden
                    title={`${pending} items waiting for review`}
                    className="relative size-1.5 shrink-0 rounded-full bg-danger"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {/* slim footer - exit only */}
      <div className="border-t border-up-border p-2">
        <button
          type="button"
          onClick={() => navigate({ name: "home" })}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to site
        </button>
      </div>
    </aside>
  );
}

function ConsoleTopBar({
  tab,
  items,
  moderationPending,
  approvalsPending,
  user,
  onTab,
}: {
  tab: TabKey;
  items: typeof ALL_TABS;
  moderationPending: number;
  approvalsPending: number;
  user: SafeUserDTO;
  onTab: (key: TabKey, openNew?: boolean) => void;
}) {
  return (
    <header className="lg:hidden">
      <div className="flex items-center gap-3 rounded-2xl border border-up-border bg-card p-4 shadow-sm">
        <img
          src="/ks-logo.svg"
          alt="Kyungsung University crest"
          className="h-9 w-9 shrink-0 object-contain object-left"
        />
        <span aria-hidden className="h-8 w-px bg-up-border" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight tracking-tight text-foreground">Console</p>
          <p className="truncate text-[11px] text-muted-foreground">Kyungsung University</p>
        </div>
        <StaffBadge role={user.role} />
      </div>
      <nav aria-label="Admin sections" className="nice-scroll mt-3 overflow-x-auto">
        <div className="flex min-w-max gap-1.5 pb-1">
          {items.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            const pending = key === "moderation" ? moderationPending : key === "approvals" ? approvalsPending : 0;
            const showCount = pending > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTab(key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                  active
                    ? "border-primary-100 bg-primary-50 text-primary-700"
                    : "border-up-border bg-card text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
                {showCount ? (
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                      active ? "bg-card text-danger" : "bg-danger-soft text-danger"
                    )}
                  >
                    {pending}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

function ContentHeader({
  title,
  description,
  loadedAt,
  refreshing,
  onRefresh,
  className,
}: {
  title: string;
  description: string;
  loadedAt?: number;
  refreshing: boolean;
  onRefresh: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">{title}</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3 pb-0.5">
        <span aria-live="polite" className="hidden text-xs text-muted-foreground sm:block">
          {loadedAt ? `Updated ${timeAgo(new Date(loadedAt).toISOString())}` : "Loading…"}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-8 rounded-lg"
          aria-label="Refresh data"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn("size-3.5", refreshing && "animate-spin")} aria-hidden />
        </Button>
      </div>
    </div>
  );
}

/** Standard white card with a bold title + muted caption (+ optional right slot). */
function Panel({
  title,
  caption,
  right,
  className,
  children,
}: {
  title: string;
  caption?: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn("rounded-2xl border border-up-border bg-card p-4 shadow-card md:p-5", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-foreground">{title}</h2>
          {caption ? <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

// ============================================================
// Pagination - shared minimal pager used by every listing tab
// ============================================================

const PROJECTS_PER_PAGE = 8;
const USERS_PER_PAGE = 10;
const DEPARTMENTS_PER_PAGE = 9;

/**
 * Fixed-size page window - the pager always renders the same slots:
 *   edges:  `1 2 3 4 5 … N`  /  `1 … N-4 N-3 N-2 N-1 N`
 *   middle: `1 … p-1 p p+1 … N`
 * so its width never changes while navigating (e.g. `1 2 3 … 100`).
 */
function pageList(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 3) return [1, 2, 3, 4, 5, "…", totalPages];
  if (page >= totalPages - 2)
    return [1, "…", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  return [1, "…", page - 1, page, page + 1, "…", totalPages];
}

/** Minimal pager: “Showing a–b of N” left, compact page buttons right. Hides itself when it fits on one page. */
function Pagination({
  page,
  totalPages,
  total,
  perPage,
  unit,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  unit: string;
  onPage: (p: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  const btn =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <nav
      aria-label={`${unit} pagination`}
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-xs text-muted-foreground" aria-live="polite">
        Showing <span className="font-semibold text-foreground">{from}–{to}</span> of{" "}
        <span className="font-semibold text-foreground">{total.toLocaleString()}</span> {unit}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={cn(
              btn,
              "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              page === 1 && "pointer-events-none opacity-40"
            )}
            onClick={() => onPage(page - 1)}
            disabled={page === 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          {pageList(page, totalPages).map((p, i) =>
            p === "…" ? (
              <span
                key={`gap-${i}`}
                aria-hidden
                className="inline-flex h-8 min-w-5 items-center justify-center text-xs text-muted-foreground"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                aria-current={p === page ? "page" : undefined}
                onClick={() => onPage(p)}
                className={cn(
                  btn,
                  p === page
                    ? "bg-primary-600 text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                )}
              >
                {p}
              </button>
            )
          )}
          <button
            type="button"
            className={cn(
              btn,
              "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
              page === totalPages && "pointer-events-none opacity-40"
            )}
            onClick={() => onPage(page + 1)}
            disabled={page === totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      ) : null}
    </nav>
  );
}

/** Compact status card - sidebar footer on ≥ lg (dark), top of Overview below lg (light). */
function SystemMiniCard({
  storage,
  className,
  dark = false,
}: {
  storage?: AdminOverviewDTO["storage"];
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        dark ? "border-white/10 bg-white/[0.06]" : "border-up-border bg-surface-muted/50",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-success" />
        </span>
        <p className={cn("text-xs font-semibold", dark ? "text-white" : "text-foreground")}>
          All systems operational
        </p>
      </div>
      <p
        className={cn(
          "mt-1 pl-[18px] text-[11px] leading-relaxed",
          dark ? "text-white/50" : "text-muted-foreground"
        )}
      >
        SQLite{storage ? ` · ${storage.uploadedFiles} files stored` : ""}
      </p>
    </div>
  );
}

// ============================================================
// Shared small pieces
// ============================================================

function CoverThumb({
  src,
  accent,
  category,
  className,
}: {
  src?: string | null;
  accent?: string | null;
  category: string;
  className?: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        className={cn("shrink-0 rounded-lg object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br",
        accentOf(accent).cover,
        className
      )}
    >
      <CategoryIcon category={category} className="size-4 text-primary-700" />
    </span>
  );
}

function DeptChip({ code, accent }: { code: string; accent?: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-up-border bg-surface-muted/60 px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
      <DeptDot accent={accent ?? "teal"} className="size-1.5" />
      {code}
    </span>
  );
}

function RoleChip({ role }: { role: string }) {
  if (role === "STUDENT") {
    return (
      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Student
      </span>
    );
  }
  return <StaffBadge role={role} />;
}

/** rAF count-up that respects reduced motion - gives every number a live "landing" feel. */
function useCountUp(target: number, duration = 900): number {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduceMotion) return; // derived below - no animation needed
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduceMotion]);
  return reduceMotion ? target : value;
}

/** Large KPI tile for the primary metrics row - colored tile, animated number, optional trend chip. */
function HeroStatCard({
  label,
  value,
  icon: Icon,
  sub,
  compactViews = false,
  delay = 0,
  tone = "primary",
  trend,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  sub?: string;
  /** render the counted value through formatViews (15.5k style) */
  compactViews?: boolean;
  delay?: number;
  tone?: "primary" | "success" | "info";
  /** real-data trend chip - either a % vs the previous month or a raw delta */
  trend?: { pct?: number; delta?: number };
}) {
  const reduceMotion = useReducedMotion();
  const shown = useCountUp(value);
  const tileTone = {
    primary: "bg-primary-50 text-primary-700 group-hover:bg-primary-100",
    success: "bg-success-soft text-success group-hover:bg-success-soft/70",
    info: "bg-info-soft text-info group-hover:bg-info-soft/70",
  }[tone];
  const trendDown = trend?.pct !== undefined && trend.pct < 0;
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-up-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary-50 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <span className={cn("relative flex size-9 items-center justify-center rounded-xl transition-colors", tileTone)}>
        <Icon className="size-4.5" aria-hidden />
      </span>
      <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">
        {compactViews ? formatViews(shown) : shown.toLocaleString()}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{label}</p>
      {trend ? (
        <p
          className={cn(
            "mt-1.5 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
            trendDown ? "bg-danger-soft text-danger" : "bg-success-soft text-success"
          )}
        >
          {trendDown ? (
            <TrendingDown className="size-3" aria-hidden />
          ) : (
            <TrendingUp className="size-3" aria-hidden />
          )}
          {trend.pct !== undefined
            ? `${trend.pct > 0 ? "+" : ""}${trend.pct}% vs last month`
            : `+${trend.delta} this month`}
        </p>
      ) : null}
      {sub ? <p className="mt-auto pt-2 text-xs text-muted-foreground">{sub}</p> : null}
    </motion.div>
  );
}

/** "Needs attention" tile - the three review queues, each row jumps to the right place. */
function AttentionCard({
  overview,
  onAction,
  delay = 0,
}: {
  overview: AdminOverviewDTO;
  onAction: (target: TabKey, openNew?: boolean) => void;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const shown = useCountUp(
    overview.pendingVerifications + overview.openReports + overview.pendingJoinRequests
  );
  const allClear = shown === 0;
  const queues: {
    label: string;
    count: number;
    dot: string;
    go: (() => void) | null;
    hint: string;
  }[] = [
    {
      label: "To verify",
      count: overview.pendingVerifications,
      dot: "bg-warning",
      go: () => onAction("moderation"),
      hint: "Verification requests - review in Moderation",
    },
    {
      label: "Reports",
      count: overview.openReports,
      dot: "bg-danger",
      go: () => onAction("moderation"),
      hint: "Review in Moderation",
    },
    {
      label: "Join requests",
      count: overview.pendingJoinRequests,
      dot: "bg-primary-500",
      go: null,
      hint: "Reviewed on each project page by the team owner",
    },
  ];
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" }}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-shadow hover:shadow-md",
        allClear ? "border-up-border bg-card" : "border-warning/40 bg-warning-soft/50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl",
            allClear ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
          )}
        >
          {allClear ? <BadgeCheck className="size-4.5" aria-hidden /> : <AlertTriangle className="size-4.5" aria-hidden />}
        </span>
        {allClear ? (
          <span className="rounded-full bg-success-soft px-2.5 py-1 text-[11px] font-bold text-success">
            All clear
          </span>
        ) : null}
      </div>
      <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">
        {shown.toLocaleString()}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">
        {allClear ? "Nothing waiting on you" : "items waiting on you"}
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {queues.map((q) => {
          const body = (
            <>
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden className={cn("size-2 shrink-0 rounded-full", q.dot)} />
                <span className="truncate">{q.label}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1 font-bold tabular-nums">
                {q.count}
                {q.go ? <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden /> : null}
              </span>
            </>
          );
          return (
            <li key={q.label}>
              {q.go ? (
                <button
                  type="button"
                  onClick={q.go}
                  title={q.hint}
                  className="group flex w-full items-center justify-between gap-2 rounded-lg bg-background/85 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-card"
                >
                  {body}
                </button>
              ) : (
                <div
                  title={q.hint}
                  className="flex w-full cursor-help items-center justify-between gap-2 rounded-lg bg-white/50 px-2.5 py-1.5 text-xs font-medium text-foreground"
                >
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

/** Dark brand band greeting the operator - mirrors the landing hero's night surface. */
function WelcomeBand({
  overview,
  userName,
  onQueues,
}: {
  overview: AdminOverviewDTO;
  userName: string;
  onQueues: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = format(new Date(), "EEEE, MMMM d");
  const pending = overview.pendingVerifications + overview.openReports;

  const chips: { label: string; count: number; dot: string }[] = [
    { label: "verifications", count: overview.pendingVerifications, dot: "bg-warning" },
    { label: "reports", count: overview.openReports, dot: "bg-danger" },
  ].filter((c) => c.count > 0);

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      aria-label="Console welcome"
      className="relative rounded-2xl border border-up-border bg-card p-5 shadow-card md:p-6"
    >
      <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {today} · {UNIVERSITY.shortName} showcase
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground md:text-2xl">
            {greeting}, {userName.split(" ")[0]}
          </h2>
          <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
            {pending > 0
              ? `${pending} ${pending === 1 ? "item needs" : "items need"} your review - the rest of the showcase is healthy and live.`
              : "Everything is reviewed - the showcase is healthy and live."}
          </p>
        </div>
        {chips.length > 0 ? (
          <button
            type="button"
            onClick={onQueues}
            className="flex flex-wrap items-center gap-2 rounded-full bg-primary-50 px-4 py-2 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100"
          >
            {chips.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1.5">
                <span aria-hidden className={cn("size-2 rounded-full", c.dot)} />
                {c.count} {c.label}
              </span>
            ))}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
    </motion.section>
  );
}

// ============================================================
// Overview tab - mission control
// ============================================================

function OverviewTab({
  overview,
  error,
  onRetry,
  navigate,
  onQuickAction,
  isAdmin,
}: {
  overview: AdminOverviewDTO | null;
  error: boolean;
  onRetry: () => void;
  navigate: Navigate;
  onQuickAction: (target: TabKey, openNew?: boolean) => void;
  isAdmin: boolean;
}) {
  const { user } = useAppStore();
  const reduceMotion = useReducedMotion();

  if (error && !overview) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load the overview"
        hint="The admin overview API did not respond. Check the session and try again."
        action={
          <Button onClick={onRetry} variant="outline" className="rounded-xl font-semibold">
            Try again
          </Button>
        }
      />
    );
  }

  if (!overview) {
    return (
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
        <div className="min-w-0 space-y-5">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const signups = overview.signupsByMonth;
  const lastSignups = signups[signups.length - 1]?.count ?? 0;
  const prevSignups = signups[signups.length - 2]?.count ?? 0;
  const trendPct =
    prevSignups > 0 && lastSignups > 0
      ? Math.round(((lastSignups - prevSignups) / prevSignups) * 100)
      : null;

  return (
    <div className="space-y-4">
      {/* ---------- welcome band ---------- */}
      <WelcomeBand
        overview={overview}
        userName={user?.displayName ?? "Admin"}
        onQueues={() => onQuickAction("moderation")}
      />

      {/* main grid - dashboard column + activity rail (reference console layout) */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          {/* ---------- primary KPIs ---------- */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <HeroStatCard
              label="Total users"
              value={overview.users}
              icon={Users}
              tone="primary"
              trend={
                trendPct !== null && trendPct !== 0
                  ? { pct: trendPct }
                  : lastSignups > 0
                    ? { delta: lastSignups }
                    : undefined
              }
              sub={`${overview.students} students · ${overview.professors} professors · ${overview.moderators} moderators`}
              delay={0.05}
            />
            <HeroStatCard
              label="Projects"
              value={overview.projects}
              icon={FolderKanban}
              tone="success"
              sub={`${overview.published} published · ${overview.drafts} drafts`}
              delay={0.1}
            />
            <HeroStatCard
              label="Total views"
              value={overview.totalViews}
              icon={Eye}
              tone="info"
              compactViews
              sub={`${overview.comments} comments · ${overview.resources} resources`}
              delay={0.15}
            />
            <AttentionCard overview={overview} onAction={onQuickAction} delay={0.2} />
          </div>

          {/* ---------- charts row ---------- */}
          <div className="grid gap-3 lg:grid-cols-2">
            <GrowthChartCard data={overview.signupsByMonth} />
            <RoleDonutCard overview={overview} />
          </div>

          {/* ---------- recent projects table ---------- */}
          <RecentProjectsCard
            projects={overview.recentProjects}
            navigate={navigate}
            onViewAll={() => onQuickAction("projects")}
          />

          {/* ---------- sections by classID ---------- */}
          <SectionsCard byClass={overview.byClass} />
        </div>

        {/* ---------- right rail ---------- */}
        <div className="min-w-0 space-y-4">
          <ActivityCard items={overview.activity} navigate={navigate} />
          <QuickActionsCard overview={overview} onAction={onQuickAction} isAdmin={isAdmin} />
          <SystemCard storage={overview.storage} />
        </div>
      </div>
    </div>
  );
}

// ---------- overview cards ----------

function ActivityCard({
  items,
  navigate,
  className,
}: {
  items: AdminActivityItem[];
  navigate: Navigate;
  className?: string;
}) {
  return (
    <Panel
      title="Recent activities"
      caption="Latest actions across the platform"
      className={className}
      right={
        <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
          {items.length}
        </span>
      }
    >
      {items.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Nothing has happened yet - activity lands here as members work.
        </p>
      ) : (
        <ul className="nice-scroll mt-3 max-h-[22rem] space-y-0.5 overflow-y-auto pr-1">
          {items.map((item, i) => (
            <ActivityRow
              key={item.id}
              item={item}
              last={i === items.length - 1}
              navigate={navigate}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ActivityRow({
  item,
  last,
  navigate,
}: {
  item: AdminActivityItem;
  last: boolean;
  navigate: Navigate;
}) {
  const Icon = ACTIVITY_ICONS[item.kind];
  const view = item.href ? activityToView(item.href) : null;
  const rowClass = "relative flex items-center gap-3 rounded-xl p-2";
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-xl",
          item.kind === "REPORT"
            ? "bg-danger-soft text-danger"
            : "bg-primary-50 text-primary-700"
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{item.text}</span>
        {item.detail ? (
          <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
        ) : null}
      </span>
      <span className="shrink-0 whitespace-nowrap text-[11px] font-medium text-muted-foreground">
        {timeAgo(item.createdAt)}
      </span>
    </>
  );
  return (
    <li className="relative">
      {!last ? (
        <span
          aria-hidden
          className="absolute bottom-0 left-[23px] top-10 w-px bg-up-border"
        />
      ) : null}
      {view ? (
        <button
          type="button"
          onClick={() => navigate(view)}
          className={cn(rowClass, "w-full text-left transition-colors hover:bg-surface-muted")}
        >
          {body}
        </button>
      ) : (
        <div className={rowClass}>{body}</div>
      )}
    </li>
  );
}

/** "Member growth" - hand-rolled SVG area chart of monthly signups (reference dashboard style). */
function GrowthChartCard({
  data,
  className,
}: {
  data: { month: string; count: number }[];
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const W = 560;
  const H = 230;
  const PL = 36;
  const PR = 14;
  const PT = 16;
  const PB = 30;
  const iw = W - PL - PR;
  const ih = H - PT - PB;
  const max = Math.max(1, ...data.map((d) => d.count));
  const top = Math.max(4, Math.ceil(max / 4) * 4);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const x = (i: number) => PL + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PT + ih - (v / top) * ih;
  const linePath = data.length
    ? `M${data.map((d, i) => `${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(" L")}`
    : "";
  const areaPath = data.length
    ? `${linePath} L${x(data.length - 1).toFixed(1)},${(PT + ih).toFixed(1)} L${x(0).toFixed(1)},${(PT + ih).toFixed(1)} Z`
    : "";
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);

  return (
    <Panel
      title="Member growth"
      caption={`New signups per month · ${total} total`}
      className={className}
      right={
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-bold text-primary-700">
          <span aria-hidden className="size-2 rounded-full bg-primary-500" />
          Signups
        </span>
      }
    >
      {data.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">No signup data yet.</p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-2 h-auto w-full"
          role="img"
          aria-label={`Area chart of monthly signups, ${total} total`}
        >
          <defs>
            <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--up-primary-500)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--up-primary-500)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PL}
                x2={W - PR}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--up-border)"
                strokeDasharray="3 4"
              />
              <text x={PL - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--up-ink-500)">
                {t}
              </text>
            </g>
          ))}
          {reduceMotion ? (
            <>
              <path d={areaPath} fill="url(#growth-fill)" />
              <path
                d={linePath}
                fill="none"
                stroke="var(--up-primary-500)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          ) : (
            <>
              <motion.path
                d={areaPath}
                fill="url(#growth-fill)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.3 }}
              />
              <motion.path
                d={linePath}
                fill="none"
                stroke="var(--up-primary-500)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            </>
          )}
          {data.map((d, i) => (
            <g key={d.month}>
              <circle
                cx={x(i)}
                cy={y(d.count)}
                r="3.5"
                fill="#fff"
                stroke="var(--up-primary-500)"
                strokeWidth="2"
              >
                <title>{`${monthLabel(d.month)}: ${d.count} ${d.count === 1 ? "signup" : "signups"}`}</title>
              </circle>
              <text
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="var(--up-ink-500)"
              >
                {monthLabel(d.month)}
              </text>
            </g>
          ))}
        </svg>
      )}
    </Panel>
  );
}

/** "Community make-up" - SVG donut of members by role with center total + legend. */
function RoleDonutCard({
  overview,
  className,
}: {
  overview: AdminOverviewDTO;
  className?: string;
}) {
  const students = Math.max(0, overview.students);
  const staff = Math.max(0, overview.professors + overview.moderators);
  const admins = Math.max(0, overview.users - students - staff);
  const slices = [
    { label: "Students", value: students, color: "var(--up-primary-500)" },
    { label: "Professors", value: overview.professors, color: "var(--up-info)" },
    { label: "Moderators", value: overview.moderators, color: "var(--up-warning, #d7a70f)" },
    { label: "Admins", value: admins, color: "#fcaf17" },
  ].filter((s) => s.value > 0);
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  // dasharray on a 100-unit circumference (r = 15.915) keeps the math readable
  const R = 15.915;
  let acc = 0;
  const segs = slices.map((s) => {
    const len = (s.value / total) * 100;
    const seg = { ...s, len, offset: 25 - acc };
    acc += len;
    return seg;
  });

  return (
    <Panel title="Community make-up" caption="Members by role" className={className}>
      {total === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">No members yet.</p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-5">
          <div className="relative size-36 shrink-0">
            <svg viewBox="0 0 42 42" className="size-full -rotate-90" role="img" aria-label="Donut chart of members by role">
              <circle cx="21" cy="21" r={R} fill="none" stroke="var(--up-surface-muted)" strokeWidth="5.5" />
              {segs.map((s) => (
                <circle
                  key={s.label}
                  cx="21"
                  cy="21"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="5.5"
                  strokeDasharray={`${s.len} ${100 - s.len}`}
                  strokeDashoffset={s.offset}
                >
                  <title>{`${s.label}: ${s.value}`}</title>
                </circle>
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {total.toLocaleString()}
              </p>
              <p className="text-[11px] font-medium text-muted-foreground">Total members</p>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2.5">
            {segs.map((s) => (
              <li key={s.label} className="flex items-center gap-2.5 text-sm">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
                <span className="font-bold tabular-nums text-foreground">{s.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

/** "Recent projects" - reference-style management table fed by the overview payload. */
function RecentProjectsCard({
  projects,
  navigate,
  onViewAll,
  className,
}: {
  projects: ProjectListItem[];
  navigate: Navigate;
  onViewAll: () => void;
  className?: string;
}) {
  const rows = projects.slice(0, 6);
  return (
    <section
      className={cn("overflow-hidden rounded-2xl border border-up-border bg-card shadow-card", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 md:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-foreground">Recent projects</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Latest submissions across the showcase</p>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="shrink-0 text-xs font-bold text-primary-700 transition-colors hover:text-primary-600"
        >
          View all
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-5 text-sm text-muted-foreground">No projects have been submitted yet.</p>
      ) : (
        <div className="scrollbar-none mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-y border-up-border bg-surface-muted/50 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-bold md:px-5">
                  Project
                </th>
                <th scope="col" className="px-3 py-2 font-bold">
                  Status
                </th>
                <th scope="col" className="hidden px-3 py-2 font-bold sm:table-cell">
                  Views
                </th>
                <th scope="col" className="hidden px-3 py-2 font-bold lg:table-cell">
                  Team lead
                </th>
                <th scope="col" className="hidden px-3 py-2 font-bold md:table-cell">
                  Submitted
                </th>
                <th scope="col" className="px-4 py-2 text-right font-bold md:px-5">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-up-border">
              {rows.map((p) => {
                const lead = p.members.find((m) => m.role === "OWNER") ?? p.members[0];
                return (
                  <tr key={p.id} className="group transition-colors hover:bg-surface-muted/40">
                    <td className="px-4 py-2.5 md:px-5">
                      <button
                        type="button"
                        onClick={() => navigate({ name: "project", slug: p.slug })}
                        className="flex items-center gap-3 text-left"
                      >
                        <CoverThumb
                          src={p.coverImage}
                          accent={p.department.accent}
                          category={p.category}
                          className="size-10"
                        />
                        <span className="min-w-0">
                          <span className="block max-w-[240px] truncate font-semibold text-foreground group-hover:text-primary-700">
                            {p.title}
                          </span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <DeptDot accent={p.department.accent} className="size-1.5" />
                            {p.department.code}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusChip project={p} />
                    </td>
                    <td className="hidden px-3 py-2.5 sm:table-cell">
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatViews(p.views)}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 lg:table-cell">
                      {lead ? (
                        <span className="flex items-center gap-2">
                          <UserAvatar name={lead.name} avatarUrl={lead.avatarUrl} className="size-7" ring={false} />
                          <span className="max-w-[120px] truncate text-xs font-medium text-foreground">
                            {lead.name}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground md:table-cell">
                      {timeAgo(p.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 text-right md:px-5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-lg text-muted-foreground hover:text-primary-700"
                        aria-label={`Open ${p.title}`}
                        onClick={() => navigate({ name: "project", slug: p.slug })}
                      >
                        <ArrowUpRight className="size-4" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Published/Draft pill + featured star + verified check for the recent-projects table. */
function StatusChip({ project }: { project: ProjectListItem }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
          project.status === "PUBLISHED"
            ? "bg-success-soft text-success"
            : project.status === "PENDING"
              ? "bg-warning-soft text-warning"
              : project.status === "REJECTED"
                ? "bg-danger-soft text-danger"
                : "bg-surface-muted text-muted-foreground"
        )}
      >
        {statusLabel(project.status)}
      </span>
      {project.featured ? (
        <span
          className="inline-flex items-center rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning"
          title="Featured on campus"
        >
          <Star className="size-3" aria-hidden />
        </span>
      ) : null}
      {project.verified ? (
        <BadgeCheck className="size-3.5 shrink-0 text-info" aria-label="Faculty verified" />
      ) : null}
    </span>
  );
}

/** "Sections" - compact classID table (students + projects per section). */
function SectionsCard({ byClass, className }: { byClass: AdminOverviewDTO["byClass"]; className?: string }) {
  const totalStudents = byClass.reduce((sum, c) => sum + c.students, 0);
  return (
    <section
      className={cn("overflow-hidden rounded-2xl border border-up-border bg-card shadow-card", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 md:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-foreground">Sections</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Students and projects grouped by classID - {byClass.length} section
            {byClass.length === 1 ? "" : "s"} · {totalStudents} students
          </p>
        </div>
      </div>
      {byClass.length === 0 ? (
        <p className="px-5 py-5 text-sm text-muted-foreground">
          No sections yet - students join one when their accounts are provisioned.
        </p>
      ) : (
        <div className="scrollbar-none mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-y border-up-border bg-surface-muted/50 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-bold md:px-5">
                  ClassID
                </th>
                <th scope="col" className="px-3 py-2 font-bold">
                  Students
                </th>
                <th scope="col" className="px-3 py-2 font-bold">
                  Projects
                </th>
                <th scope="col" className="px-4 py-2 text-right font-bold md:px-5">
                  <span className="sr-only">Share</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-up-border">
              {byClass.map((c) => (
                <tr key={c.classId} className="transition-colors hover:bg-surface-muted/40">
                  <td className="px-4 py-2.5 md:px-5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                      <Users className="size-3 text-primary-700" aria-hidden />
                      {c.classId}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold tabular-nums text-foreground">{c.students}</td>
                  <td className="px-3 py-2.5 font-semibold tabular-nums text-foreground">{c.projects}</td>
                  <td className="px-4 py-2.5 md:px-5">
                    <span aria-hidden className="ml-auto block h-1.5 rounded-full bg-primary-100"
                      style={{
                        width: `${Math.round((c.students / Math.max(1, totalStudents)) * 100)}%`,
                        maxWidth: "10rem",
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SystemCard({
  storage,
  className,
}: {
  storage: AdminOverviewDTO["storage"];
  className?: string;
}) {
  const rows: { label: string; value: string; ok?: boolean }[] = [
    { label: "Database (SQLite)", value: "Operational", ok: true },
    {
      label: "Storage",
      value: `${storage.uploadedFiles} uploaded files · ${storage.galleryImages} gallery images`,
    },
    {
      label: "Resources",
      value: `${storage.uploadedResources} uploaded · ${storage.linkedResources} linked`,
    },
  ];
  return (
    <Panel title="System" caption="Live platform status" className={className}>
      <ul className="mt-2 divide-y divide-up-border">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-3 py-2 first:pt-1.5 last:pb-0"
          >
            <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-foreground">
              <span aria-hidden className="size-2 rounded-full bg-success" />
              {row.label}
            </span>
            <span
              className={cn(
                "min-w-0 truncate text-right text-xs",
                row.ok ? "font-semibold text-success" : "font-medium text-muted-foreground"
              )}
            >
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function QuickActionsCard({
  overview,
  onAction,
  isAdmin,
  className,
}: {
  overview: AdminOverviewDTO;
  onAction: (target: TabKey, openNew?: boolean) => void;
  isAdmin: boolean;
  className?: string;
}) {
  const actions: {
    label: string;
    hint: string;
    icon: LucideIcon;
    go: () => void;
    count?: number;
    danger?: boolean;
  }[] = [
    ...(isAdmin
      ? [
          {
            label: "Review account requests",
            hint: "Approve student intake & provision accounts",
            icon: ListChecks,
            go: () => onAction("approvals"),
            count: overview.pendingAccountRequests,
          },
        ]
      : []),
    {
      label: "Review verifications",
      hint: "Faculty-verified badge queue",
      icon: ShieldCheck,
      go: () => onAction("moderation"),
      count: overview.pendingVerifications,
    },
    {
      label: "Moderate reports",
      hint: "Open community reports",
      icon: Flag,
      go: () => onAction("moderation"),
      count: overview.openReports,
      danger: true,
    },
    ...(isAdmin
      ? [
          {
            label: "Add member",
            hint: "Create a student or staff account",
            icon: UserPlus,
            go: () => onAction("users", true),
          },
          {
            label: "Add department",
            hint: "Extend the catalogue",
            icon: Building2,
            go: () => onAction("departments", true),
          },
        ]
      : []),
  ];
  return (
    <Panel title="Quick actions" caption="Jump into the most common tasks" className={className}>
      <div className="mt-3 grid gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={action.go}
              className="group flex items-center gap-2.5 rounded-xl border border-up-border bg-surface-muted/50 p-2.5 text-left transition-colors hover:border-up-border-strong hover:bg-primary-50/70"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-card text-primary-700 shadow-sm ring-1 ring-up-border">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary-700">
                  {action.label}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{action.hint}</span>
              </span>
              {action.count ? (
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                    action.danger ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning"
                  )}
                >
                  {action.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

// ============================================================
// Projects tab - search / filter / feature / publish / delete
// ============================================================

function ProjectsTab({
  navigate,
  onChanged,
  refreshTick,
  onLoaded,
}: {
  navigate: Navigate;
  onChanged: () => void;
  refreshTick: number;
  onLoaded: (ok: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 300);
  const [status, setStatus] = useState("ALL");
  const [dept, setDept] = useState("ALL");
  const [rows, setRows] = useState<AdminProjectRow[] | null>(null); // null = loading
  const [loadError, setLoadError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetchAdminDepartments()
      .then((d) => {
        if (!cancelled) setDepartments(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    fetchAdminProjects({
      query: debouncedQuery || undefined,
      status: status === "ALL" ? undefined : status,
      dept: dept === "ALL" ? undefined : dept,
    })
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        onLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Could not load projects";
        setRows([]);
        setLoadError(message);
        onLoaded(false);
        // moderators hit the server's admin-only gate - the inline notice explains it,
        // no extra toast needed for that expected case
        if (!/administrator/i.test(message)) toast.error(message);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, status, dept, refreshTick, onLoaded]);

  const patchRow = (id: string, patch: Partial<AdminProjectRow>) => {
    setRows((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, ...patch } : r)) : prev));
  };

  const setFeatured = async (row: AdminProjectRow, featured: boolean) => {
    if (busyId) return;
    setBusyId(row.id);
    patchRow(row.id, { featured }); // optimistic
    try {
      await updateAdminProject({ id: row.id, featured });
      toast.success(
        featured ? `“${row.title}” is now featured` : `“${row.title}” removed from featured`
      );
      onChanged();
    } catch (e) {
      patchRow(row.id, { featured: !featured }); // revert
      toast.error(e instanceof Error ? e.message : "Could not update the project");
    } finally {
      setBusyId(null);
    }
  };

  const togglePublish = async (row: AdminProjectRow) => {
    if (busyId) return;
    const next = row.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    setBusyId(row.id);
    patchRow(row.id, { status: next }); // optimistic
    try {
      await updateAdminProject({ id: row.id, status: next });
      toast.success(
        next === "PUBLISHED" ? `“${row.title}” approved and live` : `“${row.title}” moved to drafts`
      );
      onChanged();
    } catch (e) {
      patchRow(row.id, { status: row.status }); // revert
      toast.error(e instanceof Error ? e.message : "Could not update the project");
    } finally {
      setBusyId(null);
    }
  };

  const removeProject = (row: AdminProjectRow) => {
    if (busyId) return;
    const index = rows?.findIndex((r) => r.id === row.id) ?? 0;
    deleteWithUndo({
      label: `“${row.title}”`,
      commit: () => deleteAdminProject(row.id),
      onHide: () => setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev)),
      onRestore: () => setRows((prev) => restoreAt(prev, row, index)),
      onDeleted: onChanged,
    });
  };

  const total = rows?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows
    ? rows.slice((safePage - 1) * PROJECTS_PER_PAGE, safePage * PROJECTS_PER_PAGE)
    : [];

  return (
    <div>
      {/* toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
              setRows(null);
            }}
            placeholder="Search title or summary…"
            aria-label="Search projects"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
              setRows(null);
            }}
          >
            <SelectTrigger className="w-[190px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="PENDING">Waiting for approval</SelectItem>
              <SelectItem value="REJECTED">Changes requested</SelectItem>
              <SelectItem value="DRAFT">Drafts</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={dept}
            onValueChange={(v) => {
              setDept(v);
              setPage(1);
              setRows(null);
            }}
          >
            <SelectTrigger className="w-[168px]" aria-label="Filter by department">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.code}>
                  {d.code} · {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs font-medium text-muted-foreground md:ml-auto">Newest first</p>
      </div>

      {/* rows - paged, no inner scrolling */}
      {rows === null ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : loadError && /administrator/i.test(loadError) ? (
        <div className="mt-3">
          <EmptyState
            icon={Lock}
            title="Admin access required"
            hint="Project management - featuring, publishing and deletion - is limited to administrators. Moderators can review projects from the public showcase."
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={FolderKanban}
            title="No projects match"
            hint="Try a different search, status, or department filter."
          />
        </div>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {pageRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-up-border bg-card p-2.5 shadow-sm"
              >
                <CoverThumb
                  src={row.coverImage}
                  accent={row.department?.accent}
                  category={row.category}
                  className="size-10"
                />
              <div className="min-w-0 flex-1 basis-48">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => navigate({ name: "project", slug: row.slug })}
                    className="truncate text-sm font-semibold text-foreground hover:text-primary-700"
                  >
                    {row.title}
                  </button>
                  {row.featured ? (
                    <Star className="size-3.5 shrink-0 fill-warning text-warning" aria-label="Featured" />
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">/{row.slug}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {row.department ? (
                    <DeptChip code={row.department.code} accent={row.department.accent} />
                  ) : null}
                  <StatusBadge status={row.status} />
                  {!row.hasSourceLink ? (
                    <span
                      title="No source link - this project has no demo or repository URL"
                      className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning"
                    >
                      <AlertTriangle className="size-3" aria-hidden />
                      No source link
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1" title="Views">
                  <Eye className="size-3.5" aria-hidden />
                  {formatViews(row.views)}
                </span>
                <span className="inline-flex items-center gap-1" title="Comments">
                  <MessageCircle className="size-3.5" aria-hidden />
                  {row.commentCount}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Switch
                    checked={row.featured}
                    disabled={busyId === row.id}
                    onCheckedChange={(v) => setFeatured(row, v)}
                    aria-label={`Feature ${row.title}`}
                  />
                  Featured
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg px-2.5 text-xs font-semibold"
                  disabled={busyId === row.id}
                  onClick={() => togglePublish(row)}
                >
                  {row.status === "PUBLISHED" ? "Unpublish" : row.status === "PENDING" ? "Approve" : "Publish"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg px-2.5 text-xs font-semibold"
                  onClick={() => navigate({ name: "project", slug: row.slug })}
                >
                  {row.status === "PENDING" ? "Review" : "Open"}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg px-2.5 text-xs font-semibold text-danger hover:text-danger"
                      disabled={busyId === row.id}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete “{row.title}”?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the project with its members, comments,
                        resources and timeline. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => removeProject(row)}
                        className="bg-danger text-white hover:bg-danger/90"
                      >
                        Delete project
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
            ))}
          </ul>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={total}
            perPage={PROJECTS_PER_PAGE}
            unit="projects"
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}

// ============================================================
// Users tab - search / filter / roles / create / delete
// ============================================================

/** Same rule the API enforces - 3–30 lowercase letters, numbers, dots or underscores. */
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,28})[a-z0-9]$/;

function RoleSelect({
  value,
  disabled,
  onChange,
  label,
}: {
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="h-8 w-[118px] text-xs" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="STUDENT">Student</SelectItem>
        <SelectItem value="PROFESSOR">Professor</SelectItem>
        <SelectItem value="MODERATOR">Moderator</SelectItem>
        <SelectItem value="ADMIN">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}

function UsersTab({
  navigate,
  onChanged,
  refreshTick,
  onLoaded,
  autoOpenNew = false,
  readOnly = false,
}: {
  navigate: Navigate;
  onChanged: () => void;
  refreshTick: number;
  onLoaded: (ok: boolean) => void;
  autoOpenNew?: boolean;
  /** MODERATOR sees the directory read-only - no create / role / leader / class / delete controls. */
  readOnly?: boolean;
}) {
  const { user } = useAppStore();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 300);
  const [role, setRole] = useState("ALL");
  const [rows, setRows] = useState<AdminUserRow[] | null>(null); // null = loading
  const [dialogOpen, setDialogOpen] = useState(autoOpenNew);
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editingClass, setEditingClass] = useState<AdminUserRow | null>(null);
  // full "Edit member" dialog (requirement: admins can edit every user from the console)
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [resettingUser, setResettingUser] = useState<ResetTarget | null>(null);
  // professor university-profile-link editor (requirement: faculty links manageable from the console)
  const [editingFacultyLink, setEditingFacultyLink] = useState<AdminUserRow | null>(null);
  const [facultyLinkInput, setFacultyLinkInput] = useState("");
  const [facultyLinkBusy, setFacultyLinkBusy] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetchAdminUsers({
      query: debouncedQuery || undefined,
      role: role === "ALL" ? undefined : role,
    })
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        onLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setRows([]);
        onLoaded(false);
        toast.error(e instanceof Error ? e.message : "Could not load users");
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, role, refreshTick, onLoaded]);

  const replaceRow = (updated: AdminUserRow) => {
    setRows((prev) => (prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev));
  };

  const changeRole = async (row: AdminUserRow, nextRole: string) => {
    const prevRole = row.role;
    setRows((prev) =>
      prev ? prev.map((r) => (r.id === row.id ? { ...r, role: nextRole } : r)) : prev
    ); // optimistic
    try {
      const updated = await updateAdminUser({ id: row.id, role: nextRole });
      replaceRow(updated);
      toast.success(`@${row.username} is now ${ROLE_LABELS[nextRole] ?? nextRole}`);
      onChanged(); // overview counts include role totals - keep them live
    } catch (e) {
      setRows((prev) =>
        prev ? prev.map((r) => (r.id === row.id ? { ...r, role: prevRole } : r)) : prev
      ); // revert
      toast.error(e instanceof Error ? e.message : "Could not update the role");
    }
  };

  const toggleLeader = async (row: AdminUserRow, next: boolean) => {
    setRows((prev) =>
      prev ? prev.map((r) => (r.id === row.id ? { ...r, isTeamLeader: next } : r)) : prev
    ); // optimistic
    try {
      const updated = await updateAdminUser({ id: row.id, isTeamLeader: next });
      replaceRow(updated);
      toast.success(
        next
          ? `${row.displayName} can now submit for their team`
          : `${row.displayName} is now a regular member`
      );
    } catch (e) {
      setRows((prev) =>
        prev ? prev.map((r) => (r.id === row.id ? { ...r, isTeamLeader: !next } : r)) : prev
      ); // revert
      toast.error(e instanceof Error ? e.message : "Could not update the team role");
    }
  };

  const saveClass = async (row: AdminUserRow, classId: string) => {
    try {
      const updated = await updateAdminUser({ id: row.id, classId });
      replaceRow(updated);
      toast.success(
        classId ? `@${row.username} moved to ${classId}` : `Section cleared for @${row.username}`
      );
      setEditingClass(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update the section");
    }
  };

  const saveFacultyLink = async () => {
    if (!editingFacultyLink || facultyLinkBusy) return;
    const url = facultyLinkInput.trim();
    if (url && !/^https?:\/\/\S+$/.test(url)) {
      toast.error("Enter a full URL starting with http:// or https://");
      return;
    }
    setFacultyLinkBusy(true);
    try {
      const updated = await updateAdminUser({ id: editingFacultyLink.id, universityProfileUrl: url });
      replaceRow(updated);
      toast.success(
        url
          ? `University profile link saved for @${updated.username}`
          : `University profile link cleared for @${updated.username}`
      );
      setEditingFacultyLink(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the link");
    } finally {
      setFacultyLinkBusy(false);
    }
  };

  const removeUser = () => {
    if (!deleting || deleteBusy) return;
    const row = deleting;
    const index = rows?.findIndex((r) => r.id === row.id) ?? 0;
    setDeleting(null);
    deleteWithUndo({
      label: `@${row.username}`,
      commit: () => deleteAdminUser(row.id),
      onHide: () => setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev)),
      onRestore: () => setRows((prev) => restoreAt(prev, row, index)),
      onDeleted: onChanged,
      doneMessage: `Removed @${row.username}`,
    });
  };

  const total = rows?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / USERS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows
    ? rows.slice((safePage - 1) * USERS_PER_PAGE, safePage * USERS_PER_PAGE)
    : [];

  return (
    <div>
      <PasswordResetDialog target={resettingUser} onClose={() => setResettingUser(null)} onDone={onChanged} />
      {/* toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
              setRows(null);
            }}
            placeholder="Search name, @username, student ID or section…"
            aria-label="Search users"
            className="pl-9"
          />
        </div>
        <Select
          value={role}
          onValueChange={(v) => {
            setRole(v);
            setPage(1);
            setRows(null);
          }}
        >
          <SelectTrigger className="w-[136px]" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            <SelectItem value="STUDENT">Students</SelectItem>
            <SelectItem value="PROFESSOR">Professors</SelectItem>
            <SelectItem value="MODERATOR">Moderators</SelectItem>
            <SelectItem value="ADMIN">Admins</SelectItem>
          </SelectContent>
        </Select>
        {readOnly ? (
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground md:ml-auto">
            <Lock className="size-3.5" aria-hidden />
            Read-only - directory edits are an administrator task
          </p>
        ) : (
          <Button
            onClick={() => setDialogOpen(true)}
            className="rounded-xl font-semibold md:ml-auto"
          >
            <Plus className="size-4" aria-hidden />
            New member
          </Button>
        )}
      </div>

      {/* rows - paged, no inner scrolling */}
      {rows === null ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={Users}
            title="No members match"
            hint="Try a different search or role filter."
            action={
              !readOnly ? (
                <Button onClick={() => setDialogOpen(true)} className="rounded-xl font-semibold">
                  <Plus className="size-4" aria-hidden />
                  New member
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {pageRows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-up-border bg-card p-2.5 shadow-sm"
              >
                <UserAvatar name={row.displayName} avatarUrl={row.avatarUrl} className="size-9" />
              <div className="min-w-0 flex-1 basis-44">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                  <span className="truncate">{row.displayName}</span>
                  {row.id === user?.id ? (
                    <span className="rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">
                      You
                    </span>
                  ) : null}
                  {row.isTeamLeader ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">
                      <GraduationCap className="size-3" aria-hidden />
                      Team Leader
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{row.username} · {row.email}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <RoleChip role={row.role} />
                {row.studentId ? (
                  <span
                    className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground"
                    title="Student ID"
                  >
                    {row.studentId}
                  </span>
                ) : null}
                {row.classId ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-up-border bg-surface-muted/60 px-2 py-0.5 text-[10px] font-semibold text-foreground"
                    title="Section"
                  >
                    <Users className="size-3 text-primary-700" aria-hidden />
                    {row.classId}
                  </span>
                ) : null}
                {row.role === "PROFESSOR" && row.universityProfileUrl ? (
                  <a
                    href={row.universityProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-up-border bg-surface-muted/60 px-2 py-0.5 text-[10px] font-semibold text-primary-700 hover:underline"
                    title={row.universityProfileUrl}
                  >
                    <ExternalLink className="size-3" aria-hidden />
                    University profile
                  </a>
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{row.projectCount}</span> projects
                · <span className="font-semibold text-foreground">{row.classmateCount}</span>{" "}
                classmates
              </span>
              <span className="hidden text-xs text-muted-foreground lg:inline">
                Joined {format(new Date(row.createdAt), "MMM d, yyyy")}
              </span>
              <span className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg text-muted-foreground hover:text-primary-700"
                      onClick={() => navigate({ name: "profile", username: row.username })}
                      aria-label={`View ${row.displayName}'s profile`}
                      title="View profile"
                    >
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View public profile</TooltipContent>
                </Tooltip>
                {!readOnly && row.role === "PROFESSOR" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "size-8 rounded-lg",
                          row.universityProfileUrl
                            ? "text-primary-700"
                            : "text-muted-foreground hover:text-primary-700"
                        )}
                        onClick={() => {
                          setEditingFacultyLink(row);
                          setFacultyLinkInput(row.universityProfileUrl ?? "");
                        }}
                        aria-label={`University profile link for ${row.displayName}`}
                        title="University profile link"
                      >
                        <GraduationCap className="size-3.5" aria-hidden />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>University profile link</TooltipContent>
                  </Tooltip>
                ) : null}
              </span>
              {readOnly ? null : row.id === user?.id ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-not-allowed opacity-70">
                        <RoleSelect
                          value={row.role}
                          disabled
                          onChange={() => {}}
                          label={`Role for ${row.displayName}`}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>You cannot change your own role</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-not-allowed opacity-40">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg text-danger"
                          disabled
                          aria-label="Delete member"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>You cannot delete your own account</TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <>
                  <RoleSelect
                    value={row.role}
                    onChange={(v) => changeRole(row, v)}
                    label={`Role for ${row.displayName}`}
                  />
                  <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Switch
                      checked={row.isTeamLeader}
                      onCheckedChange={(v) => toggleLeader(row, v)}
                      aria-label={`Team leader for ${row.displayName}`}
                    />
                    Leader
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-muted-foreground hover:text-primary-700"
                    onClick={() => setEditing(row)}
                    aria-label={`Edit ${row.displayName}`}
                    title="Edit member"
                  >
                    <UserCog className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-muted-foreground hover:text-primary-700"
                    onClick={() =>
                      setResettingUser({ userId: row.id, label: row.displayName, username: row.username })
                    }
                    aria-label={`Reset password for ${row.displayName}`}
                    title="Reset password and email it"
                  >
                    <KeyRound className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-muted-foreground hover:text-primary-700"
                    onClick={() => setEditingClass(row)}
                    aria-label={`Edit section for ${row.displayName}`}
                    title="Edit section (classID)"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-danger hover:text-danger"
                    onClick={() => setDeleting(row)}
                    aria-label={`Delete ${row.displayName}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </>
              )}
            </li>
          ))}
          </ul>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={total}
            perPage={USERS_PER_PAGE}
            unit="members"
            onPage={setPage}
          />
        </>
      )}

      {!readOnly ? (
        <UserFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onCreated={(created) => {
            setRows((prev) => (prev ? [created, ...prev] : prev));
            onChanged();
          }}
        />
      ) : null}

      {/* full member editor - profile, role, section and optional password reset */}
      <EditUserDialog
        key={editing?.id ?? "edit-closed"}
        row={editing}
        isSelf={editing?.id === user?.id}
        onOpenChange={(v) => !v && setEditing(null)}
        onSaved={(updated) => {
          replaceRow(updated);
          onChanged(); // role changes move the overview counts
        }}
      />

      {/* section quick-edit - moves the member into another classID (or clears it) */}
      <ClassEditDialog
        key={editingClass?.id ?? "section-closed"}
        row={editingClass}
        onOpenChange={(v) => !v && setEditingClass(null)}
        onSave={saveClass}
      />

      {/* professor university-profile link - managed from the console or by the professor */}
      <Dialog
        open={editingFacultyLink !== null}
        onOpenChange={(v) => !v && setEditingFacultyLink(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>University profile link</DialogTitle>
            <DialogDescription>
              Paste the faculty member's official profile page on the university website. Students
              see it as a redirect button on {editingFacultyLink?.displayName}'s profile.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveFacultyLink();
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="faculty-link-url">Profile URL</Label>
              <Input
                id="faculty-link-url"
                type="url"
                value={facultyLinkInput}
                onChange={(e) => setFacultyLinkInput(e.target.value)}
                maxLength={300}
                placeholder="https://kscms.ks.ac.kr/gc/CMS/ProfessorMgr/…"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingFacultyLink(null)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={facultyLinkBusy} className="rounded-xl font-semibold">
                {facultyLinkBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Save link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* delete confirmation - 409s (last admin) surface the server message via toast */}
      <AlertDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `@${deleting.username} will be permanently removed along with their posts, comments and likes. Projects they own stay online without an owner. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeUser}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {deleteBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Tiny dialog for the per-row section (classID) quick-edit. */
function ClassEditDialog({
  row,
  onOpenChange,
  onSave,
}: {
  row: AdminUserRow | null;
  onOpenChange: (v: boolean) => void;
  onSave: (row: AdminUserRow, classId: string) => void;
}) {
  // keyed by the row in the parent, so state re-seeds per member without an effect
  const [classId, setClassId] = useState(row?.classId ?? "");

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit section</DialogTitle>
          <DialogDescription>
            {row
              ? `Move @${row.username} into a classID (e.g. CD2-2025-KIM). Students share a section with their professor and teammates.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="class-edit-input">ClassID</Label>
          <Input
            id="class-edit-input"
            value={classId}
            onChange={(e) => setClassId(e.target.value.toUpperCase())}
            placeholder="CD2-2025-KIM"
            maxLength={40}
            className="uppercase"
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to remove the member from any section.
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-xl font-semibold"
            onClick={() => row && onSave(row, classId.trim())}
          >
            Save section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Full member editor - the admin console's "Edit member" dialog.
 * Covers identity (name/username/email), role, department/program, the
 * student section, the professor teaching section + faculty link, and an
 * optional password reset (blank = keep the current password).
 */
function EditUserDialog({
  row,
  isSelf,
  onOpenChange,
  onSaved,
}: {
  row: AdminUserRow | null;
  /** Editing the signed-in admin - the role selector is locked (no self-demote). */
  isSelf: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (row: AdminUserRow) => void;
}) {
  // keyed by the row in the parent, so state re-seeds per member without an effect
  const [displayName, setDisplayName] = useState(row?.displayName ?? "");
  const [role, setRole] = useState(row?.role ?? "STUDENT");
  const [username, setUsername] = useState(row?.username ?? "");
  const [email, setEmail] = useState(row?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [program, setProgram] = useState(row?.program ?? "");
  const [dept, setDept] = useState(row?.department?.code ?? "NONE");
  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  const [studentId, setStudentId] = useState(row?.studentId ?? "");
  const [classId, setClassId] = useState(row?.classId ?? "");
  const [capstone, setCapstone] = useState(row?.capstone ?? "NONE");
  const [cohortYear, setCohortYear] = useState(row?.cohortYear ? String(row.cohortYear) : "");
  const [professorName, setProfessorName] = useState(row?.professorName ?? "");
  const [isTeamLeader, setIsTeamLeader] = useState(row?.isTeamLeader ?? false);
  const [universityProfileUrl, setUniversityProfileUrl] = useState(row?.universityProfileUrl ?? "");
  const [busy, setBusy] = useState(false);

  const isStudent = role === "STUDENT";
  const isProfessor = role === "PROFESSOR";
  // What the chosen faculty calls its capstone course - Global IT's
  // "Capstone Design" is the default for every department.
  const capstoneTerm = departments.find((d) => d.code === dept)?.capstoneLabel ?? "Capstone Design";

  useEffect(() => {
    let cancelled = false;
    fetchAdminDepartments()
      .then((d) => {
        if (!cancelled) setDepartments(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const nameOk = displayName.trim().length >= 2;
  const usernameOk = USERNAME_RE.test(username);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const studentIdOk = studentId === "" || /^\d{6,10}$/.test(studentId);
  const pwOk = password === "" || password.length >= 8;
  const canSubmit =
    !!row && nameOk && usernameOk && emailOk && studentIdOk && pwOk && !busy;

  const save = async () => {
    if (!row || !canSubmit) return;
    setBusy(true);
    try {
      const updated = await updateAdminUser({
        id: row.id,
        displayName: displayName.trim(),
        username: username.trim(),
        email: email.trim(),
        // optional password reset - blank keeps the current one
        ...(password ? { password } : {}),
        role,
        dept: dept === "NONE" ? "" : dept,
        program: program.trim(),
        // section data follows the (possibly new) role - the server strips
        // student-only fields when the role moves off STUDENT
        studentId: isStudent ? studentId.trim() : "",
        classId: isStudent || isProfessor ? classId.trim() : "",
        capstone: isStudent && capstone !== "NONE" ? capstone : "",
        cohortYear: isStudent && cohortYear ? cohortYear : "",
        professorName: isStudent ? professorName.trim() : "",
        isTeamLeader: isStudent ? isTeamLeader : false,
        universityProfileUrl: isProfessor ? universityProfileUrl.trim() : undefined,
      });
      toast.success(`@${updated.username} updated`);
      onOpenChange(false);
      onSaved(updated);
    } catch (e) {
      // 409s ("already taken") and validation errors surface the server message
      toast.error(e instanceof Error ? e.message : "Could not update the member");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <UserCog className="size-4" aria-hidden />
            </span>
            Edit member
          </DialogTitle>
          <DialogDescription>
            {row
              ? `Editing @${row.username} - changes apply immediately. Leave the password blank to keep the current one.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eu-name">Full name</Label>
              <Input
                id="eu-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Doe"
                required
                minLength={2}
                maxLength={80}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-role">Role</Label>
              <Select value={role} onValueChange={setRole} disabled={isSelf}>
                <SelectTrigger id="eu-role" aria-label="Role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Student</SelectItem>
                  <SelectItem value="PROFESSOR">Professor</SelectItem>
                  <SelectItem value="MODERATOR">Moderator</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {isSelf
                  ? "You cannot change your own role."
                  : isStudent
                    ? "Section data follows the role - moving off Student clears it."
                    : "Moving off Student strips section data automatically."}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-up-border bg-surface-muted/40 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Identity
            </p>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="eu-username">Username</Label>
                <Input
                  id="eu-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, "."))}
                  placeholder="jane.doe"
                  autoComplete="off"
                  aria-invalid={!usernameOk}
                  className={cn(!usernameOk && "border-danger")}
                />
                {!usernameOk ? (
                  <p className="text-xs font-medium text-danger" aria-live="polite">
                    3–30 lowercase letters, numbers, dots or underscores
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">The sign-in userID for staff.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eu-email">Email</Label>
                <Input
                  id="eu-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isStudent ? `a${studentId || "········"}@ks.ac.kr` : "jane.doe@ks.ac.kr"}
                  autoComplete="off"
                  aria-invalid={!emailOk}
                  className={cn(!emailOk && "border-danger")}
                />
                {!emailOk ? (
                  <p className="text-xs font-medium text-danger" aria-live="polite">
                    Enter a valid email address
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {isStudent ? "Students sign in with their student number." : "University mailbox."}
                  </p>
                )}
              </div>
              <div className={cn("space-y-1.5", !isStudent && "sm:col-span-2")}>
                <Label htmlFor="eu-password">
                  New password{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="eu-password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank to keep the current password"
                    autoComplete="new-password"
                    aria-invalid={password.length > 0 && !pwOk}
                    className={cn(
                      "font-mono text-sm",
                      password.length > 0 && !pwOk && "border-danger"
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 rounded-xl"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 rounded-xl"
                    onClick={() => {
                      setPassword(generatePassword());
                      setShowPw(true);
                    }}
                    aria-label="Generate a strong password"
                    title="Generate a strong password"
                  >
                    <Dices className="size-4" aria-hidden />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {pwOk
                    ? password
                      ? "Saved on update - share it privately with the member."
                      : "Keep the current password."
                    : "At least 8 characters."}
                </p>
              </div>
              {isStudent ? (
                <div className="space-y-1.5">
                  <Label htmlFor="eu-student-id">
                    Student ID <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="eu-student-id"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))}
                    placeholder="2025307111"
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="off"
                    aria-invalid={!studentIdOk}
                    className={cn(!studentIdOk && "border-danger")}
                  />
                  {studentIdOk ? (
                    <p className="text-xs text-muted-foreground">6–10 digits - unique campus-wide.</p>
                  ) : (
                    <p className="text-xs font-medium text-danger" aria-live="polite">
                      Student ID must be 6–10 digits
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {isStudent ? (
            <div className="rounded-xl border border-up-border bg-surface-muted/40 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Section
              </p>
              <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="eu-class">ClassID</Label>
                  <Input
                    id="eu-class"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value.toUpperCase())}
                    placeholder="CD2-2025-KIM"
                    maxLength={40}
                    className="uppercase"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Students share a section with their professor and teammates.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Team role</Label>
                  <div className="flex h-9 items-center gap-2">
                    <Switch
                      id="eu-leader"
                      checked={isTeamLeader}
                      onCheckedChange={setIsTeamLeader}
                      aria-label="Team leader"
                    />
                    <Label htmlFor="eu-leader" className="text-xs font-medium text-muted-foreground">
                      {isTeamLeader ? "Team Leader - submits the project" : "Member"}
                    </Label>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="eu-capstone">{capstoneTerm}</Label>
                  <Select value={capstone} onValueChange={setCapstone}>
                    <SelectTrigger id="eu-capstone" aria-label={capstoneTerm} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Not set</SelectItem>
                      <SelectItem value="I">{capstoneTerm} I</SelectItem>
                      <SelectItem value="II">{capstoneTerm} II</SelectItem>
                      <SelectItem value="III">{capstoneTerm} III</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="eu-year">Cohort year</Label>
                  <Input
                    id="eu-year"
                    value={cohortYear}
                    onChange={(e) => setCohortYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="2025"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="eu-professor">Professor</Label>
                  <Input
                    id="eu-professor"
                    value={professorName}
                    onChange={(e) => setProfessorName(e.target.value)}
                    placeholder="Dana Kim"
                    maxLength={80}
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {isProfessor ? (
            <div className="rounded-xl border border-up-border bg-surface-muted/40 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Teaching section
              </p>
              <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="eu-prof-class">ClassID</Label>
                  <Input
                    id="eu-prof-class"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value.toUpperCase())}
                    placeholder="CD2-2026-KIM"
                    maxLength={40}
                    className="uppercase"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Students who pick this professor are enrolled into this classID.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="eu-prof-link">
                    University profile{" "}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="eu-prof-link"
                    type="url"
                    value={universityProfileUrl}
                    onChange={(e) => setUniversityProfileUrl(e.target.value)}
                    placeholder="https://kscms.ks.ac.kr/…"
                    maxLength={300}
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Official faculty page - shown as a redirect on their profile.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eu-dept">Department</Label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger id="eu-dept" aria-label="Department" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.code}>
                      {d.code} · {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-program">
                Program <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="eu-program"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                placeholder="B.S. Computer Science"
                maxLength={80}
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} className="rounded-xl font-semibold">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "jiwoo han" → "jiwoo.han" - used to auto-suggest usernames in the new-member dialog. */
function slugifyUsername(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 30);
}

/** "Prof. Dana Kim" → "dana kim" - matches a typed name against registered professors. */
function normalizeProfessorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(prof\.?|dr\.?|professor)\s+/i, "")
    .replace(/\./g, "")
    .trim();
}

/** Memorable 12-char password guaranteed to mix upper, lower and digits. */
function generatePassword(): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = lower + upper + digits;
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  const out = [pick(upper), pick(lower), pick(digits)];
  for (let i = 0; i < 9; i++) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}

function UserFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (row: AdminUserRow) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [program, setProgram] = useState("");
  const [dept, setDept] = useState("NONE");
  const [classId, setClassId] = useState("");
  const [capstone, setCapstone] = useState("NONE");
  const [cohortYear, setCohortYear] = useState("");
  const [professorName, setProfessorName] = useState("");
  const [teamRole, setTeamRole] = useState<"LEADER" | "MEMBER">("MEMBER");
  const [role, setRole] = useState("STUDENT");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(true);
  const [busy, setBusy] = useState(false);
  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);
  // registered professors - students who pick one inherit their teaching section
  const [professors, setProfessors] = useState<SafeUserDTO[]>([]);
  const [classIdTouched, setClassIdTouched] = useState(false);

  // What the chosen faculty calls its capstone course - Global IT's
  // "Capstone Design" is the default for every department.
  const capstoneTerm = departments.find((d) => d.code === dept)?.capstoneLabel ?? "Capstone Design";

  // reset every time the dialog opens
  useEffect(() => {
    if (!open) return;
    setDisplayName("");
    setStudentId("");
    setUsername("");
    setUsernameTouched(false);
    setEmail("");
    setEmailTouched(false);
    setProgram("");
    setDept("NONE");
    setClassId("");
    setClassIdTouched(false);
    setCapstone("NONE");
    setCohortYear("");
    setProfessorName("");
    setTeamRole("MEMBER");
    setRole("STUDENT");
    setPassword(generatePassword());
    setShowPw(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchAdminDepartments()
      .then((d) => {
        if (!cancelled) setDepartments(d);
      })
      .catch(() => {});
    fetchProfessorsPublic()
      .then((ps) => {
        if (!cancelled) setProfessors(ps);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const isStudent = role === "STUDENT";

  // auto-suggest a username from the display name until the admin edits it manually
  useEffect(() => {
    if (!usernameTouched) setUsername(slugifyUsername(displayName));
  }, [displayName, usernameTouched]);

  // default the university address until the admin types an explicit email:
  // students key off their student number (a<id>@ks.ac.kr), staff off the username
  useEffect(() => {
    if (emailTouched) return;
    if (isStudent && studentId) {
      setEmail(`a${studentId}@ks.ac.kr`);
      return;
    }
    setEmail(username ? `${username}@ks.ac.kr` : "");
  }, [username, studentId, isStudent, emailTouched]);

  // students inherit the teaching section of the registered professor they
  // pick - same professor ⇒ same classID (explicit admin input still wins)
  useEffect(() => {
    if (!isStudent || classIdTouched) return;
    const key = normalizeProfessorName(professorName);
    if (!key) return;
    const prof = professors.find((p) => normalizeProfessorName(p.displayName) === key);
    if (prof?.classId) setClassId(prof.classId);
  }, [professorName, professors, isStudent, classIdTouched]);

  const studentIdOk = studentId === "" || /^\d{6,10}$/.test(studentId);
  // staff always need an explicit username - there is no student number fallback
  const usernameOk = isStudent
    ? username === "" || USERNAME_RE.test(username)
    : USERNAME_RE.test(username);
  const emailOk = email === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const pwOk = password.length >= 8;
  // students sign in with their student number and receive a<id>@ks.ac.kr -
  // without a student ID both a username and an email are required;
  // staff sign in with a username backed by a university email address
  const identityOk = isStudent
    ? studentId !== "" || (username !== "" && email !== "")
    : username !== "" && email !== "";
  const canSubmit =
    displayName.trim().length >= 2 &&
    pwOk &&
    studentIdOk &&
    usernameOk &&
    emailOk &&
    identityOk &&
    !busy;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      // when the student number drives identity, let the server derive
      // a<studentId>@ks.ac.kr with the student number as the login userID
      const studentIdDrivesIdentity =
        isStudent && studentId !== "" && !usernameTouched && !emailTouched;
      const created = await createAdminUser({
        username: studentIdDrivesIdentity ? undefined : username || undefined,
        displayName: displayName.trim(),
        email: studentIdDrivesIdentity ? undefined : email.trim() || undefined,
        password,
        role,
        dept: dept === "NONE" ? undefined : dept,
        program: program.trim() || undefined,
        // section fields are student-only (requirement 6) - staff never inherit them;
        // professors carry their own teaching-section classID
        studentId: isStudent ? studentId || undefined : undefined,
        classId: isStudent || role === "PROFESSOR" ? classId.trim() || undefined : undefined,
        capstone: isStudent && capstone !== "NONE" ? capstone : undefined,
        cohortYear: isStudent && cohortYear ? Number(cohortYear) : undefined,
        professorName: isStudent ? professorName.trim() || undefined : undefined,
        isTeamLeader: isStudent ? teamRole === "LEADER" : false,
      });
      toast.success(
        isStudent
          ? `@${created.username} joined the showcase`
          : `@${created.username} provisioned - credentials emailed`
      );
      onOpenChange(false);
      onCreated(created);
    } catch (err) {
      // 409s ("already taken") and validation errors surface the server message
      toast.error(err instanceof Error ? err.message : "Could not create the member");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <UserPlus className="size-4" aria-hidden />
            </span>
            New member
          </DialogTitle>
          <DialogDescription>
            Provision an account on behalf of a student or staff member - credentials are copied to
            the email outbox and the password is shown once.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nu-name">Full name</Label>
              <Input
                id="nu-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Jane Doe"
                required
                minLength={2}
                maxLength={80}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="nu-role" aria-label="Role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Student</SelectItem>
                  <SelectItem value="PROFESSOR">Professor</SelectItem>
                  <SelectItem value="MODERATOR">Moderator</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === "ADMIN"
                  ? "Admins get this console - grant sparingly."
                  : role === "MODERATOR"
                    ? "Moderators help manage accounts and content."
                    : role === "PROFESSOR"
                      ? "Professors supervise sections and verify projects."
                      : "Students browse, submit and team up."}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-up-border bg-surface-muted/40 p-3.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Credentials
            </p>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
              {isStudent ? (
                <div className="space-y-1.5">
                  <Label htmlFor="nu-student-id">
                    Student ID <span className="font-normal text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="nu-student-id"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))}
                    placeholder="2025307111"
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="off"
                    aria-invalid={!studentIdOk}
                    className={cn(!studentIdOk && "border-danger")}
                  />
                  {studentId ? (
                    <p className="text-xs text-muted-foreground">
                      Leave username/email empty to auto-derive{" "}
                      <span className="font-semibold text-foreground">a{studentId}@ks.ac.kr</span> -
                      the student number becomes the userID.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      6–10 digits. Without it, username + email are required below.
                    </p>
                  )}
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="nu-username">
                  Username{" "}
                  <span className="font-normal text-muted-foreground">
                    {isStudent ? (studentId ? "(optional)" : "(or student ID)") : "(required)"}
                  </span>
                </Label>
                <Input
                  id="nu-username"
                  value={username}
                  onChange={(e) => {
                    setUsernameTouched(true);
                    setUsername(e.target.value.toLowerCase().replace(/\s+/g, "."));
                  }}
                  placeholder={isStudent && studentId ? studentId : "jane.doe"}
                  autoComplete="off"
                  aria-invalid={!usernameOk}
                  className={cn(!usernameOk && "border-danger")}
                />
                {!usernameOk ? (
                  <p className="text-xs font-medium text-danger" aria-live="polite">
                    {username
                      ? "3–30 lowercase letters, numbers, dots or underscores"
                      : "Required for staff accounts - 3–30 lowercase letters, numbers, dots or underscores"}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {isStudent ? "Members sign in with this name." : "Staff sign in with this username."}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nu-email">
                  Email{" "}
                  <span className="font-normal text-muted-foreground">
                    {isStudent ? (studentId ? "(optional)" : "(or student ID)") : "(auto-filled)"}
                  </span>
                </Label>
                <Input
                  id="nu-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmailTouched(true);
                    setEmail(e.target.value);
                  }}
                  placeholder={isStudent && studentId ? `a${studentId}@ks.ac.kr` : "jane.doe@ks.ac.kr"}
                  autoComplete="off"
                  aria-invalid={!!email && !emailOk}
                  className={cn(!!email && !emailOk && "border-danger")}
                />
                {!!email && !emailOk ? (
                  <p className="text-xs font-medium text-danger" aria-live="polite">
                    Enter a valid email address
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {isStudent
                      ? "Must be unique across the campus."
                      : "Defaults to the university address - edit it if the staff mailbox differs."}
                  </p>
                )}
              </div>
              <div className={cn("space-y-1.5", !isStudent && "sm:col-span-2")}>
                <Label htmlFor="nu-password">Temporary password</Label>
                <div className="flex gap-2">
                  <Input
                    id="nu-password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    aria-invalid={password.length > 0 && !pwOk}
                    className={cn("font-mono text-sm", password.length > 0 && !pwOk && "border-danger")}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 rounded-xl"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 rounded-xl"
                    onClick={() => setPassword(generatePassword())}
                    aria-label="Generate a strong password"
                    title="Generate a strong password"
                  >
                    <Dices className="size-4" aria-hidden />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {pwOk ? "Good - copy it now; it is also sent to the email outbox." : "At least 8 characters."}
                </p>
              </div>
            </div>
          </div>

          {isStudent ? (
            <div className="rounded-xl border border-up-border bg-surface-muted/40 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Section (requirement 6)
              </p>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nu-class">ClassID</Label>
                <Input
                  id="nu-class"
                  value={classId}
                  onChange={(e) => {
                    setClassIdTouched(true);
                    setClassId(e.target.value.toUpperCase());
                  }}
                  placeholder="CD2-2025-KIM"
                  maxLength={40}
                  className="uppercase"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-filled from the professor's registered class - edit to override.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nu-team-role">Team role</Label>
                <Select
                  value={teamRole}
                  onValueChange={(v) => setTeamRole(v as "LEADER" | "MEMBER")}
                >
                  <SelectTrigger id="nu-team-role" aria-label="Team role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="LEADER">Team Leader</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {teamRole === "LEADER"
                    ? "Team leaders submit the capstone project."
                    : "Members join projects their leader submits."}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="nu-capstone">{capstoneTerm}</Label>
                <Select value={capstone} onValueChange={setCapstone}>
                  <SelectTrigger id="nu-capstone" aria-label={capstoneTerm} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Not set</SelectItem>
                    <SelectItem value="I">{capstoneTerm} I</SelectItem>
                    <SelectItem value="II">{capstoneTerm} II</SelectItem>
                    <SelectItem value="III">{capstoneTerm} III</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nu-year">Cohort year</Label>
                <Input
                  id="nu-year"
                  value={cohortYear}
                  onChange={(e) => setCohortYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="2025"
                  inputMode="numeric"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nu-professor">Professor</Label>
                <Input
                  id="nu-professor"
                  value={professorName}
                  onChange={(e) => setProfessorName(e.target.value)}
                  placeholder="Dana Kim"
                  maxLength={80}
                  autoComplete="off"
                />
              </div>
            </div>
            </div>
          ) : null}

          {role === "PROFESSOR" ? (
            <div className="rounded-xl border border-up-border bg-surface-muted/40 p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Teaching section
              </p>
              <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nu-prof-class">ClassID</Label>
                  <Input
                    id="nu-prof-class"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value.toUpperCase())}
                    placeholder="CD2-2026-KIM"
                    maxLength={40}
                    className="uppercase"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Students who pick this professor are enrolled into this classID.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nu-dept">Department</Label>
              <Select value={dept} onValueChange={setDept}>
                <SelectTrigger id="nu-dept" aria-label="Department" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">No department</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.code}>
                      {d.code} · {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-program">
                Program <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="nu-program"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                placeholder="B.S. Computer Science"
                maxLength={80}
                autoComplete="off"
              />
            </div>
          </div>

          {!identityOk ? (
            <p className="text-xs font-medium text-warning" aria-live="polite">
              {isStudent
                ? "Provide a student ID, or both a username and an email - one of them must identify the account."
                : "Staff accounts need a username and a university email address."}
            </p>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit} className="rounded-xl font-semibold">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Create member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Departments tab - grid + create / edit / delete
// ============================================================

function DepartmentsTab({
  onChanged,
  refreshTick,
  onLoaded,
  autoOpenNew = false,
}: {
  onChanged: () => void;
  refreshTick: number;
  onLoaded: (ok: boolean) => void;
  autoOpenNew?: boolean;
}) {
  const [rows, setRows] = useState<AdminDepartmentDTO[] | null>(null); // null = loading
  const [tick, setTick] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(autoOpenNew);
  const [editing, setEditing] = useState<AdminDepartmentDTO | null>(null);
  const [deleting, setDeleting] = useState<AdminDepartmentDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetchAdminDepartments()
      .then((d) => {
        if (cancelled) return;
        setRows(d);
        onLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setRows([]);
        onLoaded(false);
        toast.error(e instanceof Error ? e.message : "Could not load departments");
      });
    return () => {
      cancelled = true;
    };
  }, [tick, refreshTick, onLoaded]);

  const reload = () => setTick((n) => n + 1);

  const removeDepartment = () => {
    if (!deleting || busy) return;
    const row = deleting;
    const index = rows?.findIndex((d) => d.id === row.id) ?? 0;
    setDeleting(null);
    deleteWithUndo({
      label: row.code,
      commit: () => deleteAdminDepartment(row.id),
      onHide: () => setRows((prev) => (prev ? prev.filter((d) => d.id !== row.id) : prev)),
      onRestore: () => setRows((prev) => restoreAt(prev, row, index)),
      onDeleted: onChanged,
    });
  };

  const total = rows?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEPARTMENTS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows
    ? rows.slice((safePage - 1) * DEPARTMENTS_PER_PAGE, safePage * DEPARTMENTS_PER_PAGE)
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">
          {rows ? "Project counts include drafts" : "Loading…"}
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="rounded-xl font-semibold"
        >
          <Plus className="size-4" aria-hidden />
          New department
        </Button>
      </div>

      {rows === null ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={Building2}
            title="No departments yet"
            hint="Create the first department so students can submit projects under it."
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
                className="rounded-xl font-semibold"
              >
                <Plus className="size-4" aria-hidden />
                New department
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pageRows.map((d) => (
              <article
                key={d.id}
                className="card-hover flex flex-col rounded-xl border border-up-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl bg-gradient-to-br",
                      accentOf(d.accent).cover
                    )}
                  >
                    <Building2 className="size-4 text-primary-700" aria-hidden />
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg"
                      onClick={() => {
                        setEditing(d);
                        setDialogOpen(true);
                      }}
                      aria-label={`Edit ${d.name}`}
                    >
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg text-danger hover:text-danger"
                      onClick={() => setDeleting(d)}
                      aria-label={`Delete ${d.name}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>
                <p className="mt-2.5 text-lg font-bold tracking-tight text-foreground">{d.code}</p>
                <p className="text-sm font-medium text-foreground/80">{d.name}</p>
                {d.tagline ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {d.tagline}
                  </p>
                ) : null}
                {d.website ? (
                  <a
                    href={d.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex max-w-full items-center gap-1 text-xs font-medium text-primary-700 hover:underline"
                    title={d.website}
                  >
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">University website</span>
                  </a>
                ) : null}
                <p className="mt-auto pt-2.5 text-xs font-medium text-muted-foreground">
                  {d.projectCount ?? 0} {(d.projectCount ?? 0) === 1 ? "project" : "projects"}
                  {d.capstoneLabel ? (
                    <span className="ml-2 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {d.capstoneLabel}
                    </span>
                  ) : null}
                </p>
              </article>
            ))}
          </div>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={total}
            perPage={DEPARTMENTS_PER_PAGE}
            unit="departments"
            onPage={setPage}
          />
        </>
      )}

      <DeptFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => {
          reload();
          onChanged();
        }}
      />

      {/* delete confirmation - 409 errors surface the server message via toast */}
      <AlertDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `This removes the ${deleting.name} department. Departments that still have projects cannot be deleted.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeDepartment}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Delete department
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DeptFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: AdminDepartmentDTO | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [tagline, setTagline] = useState("");
  const [website, setWebsite] = useState("");
  const [capstoneLabel, setCapstoneLabel] = useState("Capstone Design");
  const [accent, setAccent] = useState("teal");
  const [sortOrder, setSortOrder] = useState("0");
  const [busy, setBusy] = useState(false);

  // Hydrate when the dialog opens (edit) or reset (create).
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setCode(editing?.code ?? "");
    setTagline(editing?.tagline ?? "");
    setWebsite(editing?.website ?? "");
    setCapstoneLabel(editing?.capstoneLabel ?? "Capstone Design");
    setAccent(editing?.accent ?? "teal");
    setSortOrder(String(editing?.sortOrder ?? 0));
  }, [open, editing]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const payload = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      tagline: tagline.trim(),
      website: website.trim(),
      capstoneLabel: capstoneLabel.trim() || "Capstone Design",
      accent,
      sortOrder: Math.max(0, Math.floor(Number(sortOrder) || 0)),
    };
    try {
      if (editing) {
        await updateAdminDepartment({ id: editing.id, ...payload });
        toast.success(`Updated ${payload.code}`);
      } else {
        await createAdminDepartment(payload);
        toast.success(`Created ${payload.code}`);
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the department");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${editing.code}` : "New department"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dept-name">Name</Label>
            <Input
              id="dept-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="School of Computer Science"
              required
              minLength={2}
              maxLength={80}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dept-code">Code</Label>
              <Input
                id="dept-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CSE"
                required
                minLength={2}
                maxLength={8}
                className="uppercase"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-sort">Sort order</Label>
              <Input
                id="dept-sort"
                type="number"
                min={0}
                step={1}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-tagline">
              Tagline <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="dept-tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={120}
              placeholder="One line about the department"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-website">
              University website <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="dept-website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              maxLength={300}
              placeholder="https://kscms.ks.ac.kr/computer/"
            />
            <p className="text-xs text-muted-foreground">
              Shown as a redirect button on the department's showcase pages.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-capstone-label">Capstone term</Label>
            <Input
              id="dept-capstone-label"
              value={capstoneLabel}
              onChange={(e) => setCapstoneLabel(e.target.value)}
              maxLength={40}
              placeholder="Capstone Design"
            />
            <p className="text-xs text-muted-foreground">
              What this faculty calls its capstone course - Global IT uses “Capstone Design”; other faculties can rename it (e.g. “Graduation Work”).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dept-accent">Accent</Label>
            <Select value={accent} onValueChange={setAccent}>
              <SelectTrigger id="dept-accent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(ACCENTS).map((key) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2 capitalize">
                      <span className={cn("size-2.5 rounded-full", accentOf(key).dot)} aria-hidden />
                      {key}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="rounded-xl font-semibold">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {editing ? "Save changes" : "Create department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


// ============================================================
// Moderation tab - actionable verification queue + reports
// ============================================================

function ModerationTab({
  overview,
  navigate,
}: {
  overview: AdminOverviewDTO | null;
  navigate: Navigate;
}) {
  const user = useAppStore((s) => s.user);
  if (!overview) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* actionable queues - self-fetching, so they stay fresh after every decision */}
      {user?.role === "ADMIN" ? (
        <ApprovalQueueCard onReview={(slug) => navigate({ name: "project", slug })} />
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        <VerificationQueueCard onReview={(slug) => navigate({ name: "project", slug })} />
        <ReportsQueueCard />
      </div>

      <section className="rounded-2xl border border-up-border bg-card p-4 shadow-card md:p-5">
        <h2 className="text-sm font-bold tracking-tight text-foreground">How moderation works</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Approving a verification marks a project as verified; resolving a report closes it for
          review. Professors also handle verifications for their own sections from their dashboard.
          Everything applies to the live campus data.
        </p>
      </section>
    </div>
  );
}

// ============================================================
// Approvals tab - account-request inbox (requirement 3)
// ============================================================

/** Client replica of rbac.deriveClassId - prefills the review dialog's classID. */
function deriveClassIdClient(capstone: string, year: number, professor: string): string {
  const round = capstone.replace(/^CD/i, "").toUpperCase(); // I | II | III
  const surname =
    professor
      .trim()
      .split(/\s+/)
      .pop()
      ?.replace(/[^a-zA-Z가-힣]/g, "")
      .toUpperCase() || "STAFF";
  return `CD${round}-${year}-${surname}`;
}

function RequestStatusBadge({ status }: { status: string }) {
  const tone =
    status === "PENDING"
      ? "bg-warning-soft text-warning"
      : status === "APPROVED"
        ? "bg-success-soft text-success"
        : "bg-danger-soft text-danger";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        tone
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}

async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied to clipboard`);
  } catch {
    toast.error("Couldn't copy - select the text and copy manually");
  }
}

type ReqFilter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

function ApprovalsTab({
  onChanged,
  refreshTick,
  onLoaded,
}: {
  onChanged: () => void;
  refreshTick: number;
  onLoaded: (ok: boolean) => void;
}) {
  const [filter, setFilter] = useState<ReqFilter>("PENDING");
  const [rows, setRows] = useState<AccountRequestDTO[] | null>(null); // null = loading
  const [reviewing, setReviewing] = useState<AccountRequestDTO | null>(null);
  const [deleting, setDeleting] = useState<AccountRequestDTO | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAccountRequests(filter)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        onLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setRows([]);
        onLoaded(false);
        toast.error(e instanceof Error ? e.message : "Could not load account requests");
      });
    return () => {
      cancelled = true;
    };
  }, [filter, refreshTick, onLoaded]);

  const removeRequest = () => {
    if (!deleting || deleteBusy) return;
    const row = deleting;
    const index = rows?.findIndex((r) => r.id === row.id) ?? 0;
    setDeleting(null);
    deleteWithUndo({
      label: `${row.name}'s request`,
      commit: () => deleteAccountRequest(row.id),
      onHide: () => setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev)),
      onRestore: () => setRows((prev) => restoreAt(prev, row, index)),
      onDeleted: onChanged,
      doneMessage: `Removed ${row.name}'s request`,
    });
  };

  const chips: { key: ReqFilter; label: string }[] = [
    { key: "PENDING", label: "Pending" },
    { key: "APPROVED", label: "Approved" },
    { key: "REJECTED", label: "Rejected" },
    { key: "ALL", label: "All" },
  ];

  return (
    <div>
      {/* status filter chips */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              setFilter(c.key);
              setRows(null);
            }}
            aria-pressed={filter === c.key}
            className={cn(
              "inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              filter === c.key
                ? "border-primary-100 bg-primary-50 text-primary-700"
                : "border-up-border bg-card text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            )}
          >
            {c.label}
          </button>
        ))}
        <p className="ml-auto hidden text-xs text-muted-foreground sm:block">
          Approval provisions the account and emails the credentials
        </p>
      </div>

      {/* rows */}
      {rows === null ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={ListChecks}
            title={filter === "PENDING" ? "No pending requests" : "No requests here"}
            hint={
              filter === "PENDING"
                ? "New intake from the public request form will appear here for review."
                : "Try a different status filter."
            }
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-up-border bg-card p-2.5 shadow-sm"
            >
              <UserAvatar name={r.name} className="size-9" />
              <div className="min-w-0 flex-1 basis-52">
                <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">{r.studentId}</span>
                  {" · "}
                  Capstone {r.capstone} · {r.year} · {r.professor}
                </p>
                {r.decisionNote ? (
                  <p className="mt-0.5 truncate text-[11px] italic text-muted-foreground">
                    “{r.decisionNote}”
                  </p>
                ) : null}
              </div>
              <RequestStatusBadge status={r.status} />
              <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
                {timeAgo(r.createdAt)}
              </span>
              {r.status === "PENDING" ? (
                <Button
                  size="sm"
                  className="h-8 rounded-lg px-3 text-xs font-semibold"
                  onClick={() => setReviewing(r)}
                >
                  Review
                </Button>
              ) : (
                <>
                  <span className="hidden whitespace-nowrap text-[11px] text-muted-foreground md:inline">
                    {r.decidedBy ? `by ${r.decidedBy}` : ""}
                    {r.decidedAt ? ` · ${timeAgo(r.decidedAt)}` : ""}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-muted-foreground hover:text-danger"
                    onClick={() => setDeleting(r)}
                    aria-label={`Delete ${r.name}'s request`}
                    title="Delete this request row"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ReviewRequestDialog
        request={reviewing}
        onOpenChange={(v) => {
          if (!v) setReviewing(null);
        }}
        onDecided={() => {
          setRows(null); // refetch the list under the current filter
          onChanged();
        }}
      />

      {/* housekeeping confirmation for decided rows */}
      <AlertDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}'s request?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `This removes the ${deleting.status.toLowerCase()} request row for ${deleting.studentId}. If the student should re-apply, they can submit the public form again.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeRequest}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {deleteBusy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Delete request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** The heart of requirement 3: review → derive classID → pick team role → approve & provision. */
function ReviewRequestDialog({
  request,
  onOpenChange,
  onDecided,
}: {
  request: AccountRequestDTO | null;
  onOpenChange: (v: boolean) => void;
  onDecided: () => void;
}) {
  const [classId, setClassId] = useState("");
  const [teamRole, setTeamRole] = useState<"LEADER" | "MEMBER">("MEMBER");
  const [note, setNote] = useState("");
  const [rejectMode, setRejectMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApprovalResultDTO | null>(null);
  // registered professors - the classID prefills from their teaching section
  const [professors, setProfessors] = useState<SafeUserDTO[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchProfessorsPublic()
      .then((ps) => {
        if (!cancelled) setProfessors(ps);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // hydrate on every open - the classID prefills from the named professor's
  // registered teaching section (same professor ⇒ same classID), falling
  // back to the deterministic capstone · year · professor derivation
  useEffect(() => {
    if (!request) return;
    const key = normalizeProfessorName(request.professor);
    const prof = professors.find((p) => normalizeProfessorName(p.displayName) === key);
    setClassId(
      prof?.classId || deriveClassIdClient(request.capstone, request.year, request.professor)
    );
    setTeamRole("MEMBER");
    setNote("");
    setRejectMode(false);
    setConfirmOpen(false);
    setResult(null);
  }, [request, professors]);

  const decide = async (decision: "APPROVED" | "REJECTED") => {
    if (!request || busy) return;
    setBusy(true);
    try {
      if (decision === "APPROVED") {
        const res = await decideAccountRequest(request.id, {
          decision: "APPROVED",
          classId: classId.trim(),
          teamRole,
          note: note.trim() || undefined,
        });
        setResult(res);
        toast.success(`Account created for ${res.account.displayName}`);
      } else {
        await decideAccountRequest(request.id, {
          decision: "REJECTED",
          teamRole: "MEMBER",
          note: note.trim() || undefined,
        });
        toast.success(`Rejected ${request.name}'s request`);
      }
      onDecided();
      if (decision === "REJECTED") onOpenChange(false);
    } catch (e) {
      // 409s surface the server's message (e.g. "User ID already taken")
      toast.error(e instanceof Error ? e.message : "Could not save the decision");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog
        open={request !== null}
        onOpenChange={(v) => {
          if (!busy) onOpenChange(v);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          {result ? (
            /* ---------- success view: credentials + copy ---------- */
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-success-soft text-success">
                    <Check className="size-4" aria-hidden />
                  </span>
                  Account created
                </DialogTitle>
                <DialogDescription>
                  {result.account.displayName} can sign in with the credentials below - share them
                  privately if the email doesn't arrive.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-up-border bg-surface-muted/40 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      User ID
                    </p>
                    <p className="truncate font-mono text-sm font-semibold text-foreground">
                      {result.account.userId}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 rounded-lg text-xs font-semibold"
                    onClick={() => copyText(result.account.userId, "User ID")}
                  >
                    <Copy className="size-3.5" aria-hidden />
                    Copy
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-2 rounded-xl border border-up-border bg-surface-muted/40 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Temporary password
                    </p>
                    <p className="truncate font-mono text-sm font-semibold text-foreground">
                      {result.account.temporaryPassword}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 rounded-lg text-xs font-semibold"
                    onClick={() => copyText(result.account.temporaryPassword, "Temporary password")}
                  >
                    <Copy className="size-3.5" aria-hidden />
                    Copy
                  </Button>
                </div>

                <p className="flex items-start gap-2 rounded-xl bg-info-soft/60 px-3 py-2.5 text-xs leading-relaxed text-info">
                  <Mail className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Email sent to {result.account.email} - saved in the email outbox.
                </p>

                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  Section
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-up-border bg-surface-muted/60 px-2 py-0.5 text-[11px] font-semibold text-foreground">
                    <Users className="size-3 text-primary-700" aria-hidden />
                    {result.account.classId}
                  </span>
                </p>
              </div>

              <DialogFooter>
                <Button
                  onClick={() => onOpenChange(false)}
                  className="w-full rounded-xl font-semibold"
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : request ? (
            /* ---------- review view ---------- */
            <>
              <DialogHeader>
                <DialogTitle>Review request</DialogTitle>
                <DialogDescription>
                  Approving provisions the student account immediately.
                </DialogDescription>
              </DialogHeader>

              {/* read-only summary */}
              <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-xl border border-up-border bg-surface-muted/40 p-3.5 text-sm">
                <dt className="text-xs font-semibold text-muted-foreground">Student ID</dt>
                <dd className="font-medium tabular-nums text-foreground">{request.studentId}</dd>
                <dt className="text-xs font-semibold text-muted-foreground">Name</dt>
                <dd className="font-medium text-foreground">{request.name}</dd>
                <dt className="text-xs font-semibold text-muted-foreground">Capstone</dt>
                <dd className="font-medium text-foreground">
                  Capstone {request.capstone} · {request.year}
                </dd>
                <dt className="text-xs font-semibold text-muted-foreground">Professor</dt>
                <dd className="font-medium text-foreground">{request.professor}</dd>
                <dt className="text-xs font-semibold text-muted-foreground">Email</dt>
                <dd className="flex items-center gap-1.5 font-medium text-muted-foreground">
                  <Mail className="size-3.5 shrink-0" aria-hidden />
                  a{request.studentId}@ks.ac.kr
                </dd>
              </dl>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="review-class">ClassID</Label>
                  <Input
                    id="review-class"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value.toUpperCase())}
                    placeholder="CD2-2025-KIM"
                    maxLength={40}
                    className="uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    Prefilled from the professor's registered class - or capstone · year ·
                    professor when they have none. Edit if the section differs.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Team role</Label>
                  <div
                    role="radiogroup"
                    aria-label="Team role"
                    className="grid grid-cols-2 gap-2"
                  >
                    {(
                      [
                        { value: "MEMBER", label: "Member", hint: "Joins their leader's project" },
                        { value: "LEADER", label: "Team Leader", hint: "Submits the project" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={teamRole === opt.value}
                        onClick={() => setTeamRole(opt.value)}
                        className={cn(
                          "rounded-xl border p-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                          teamRole === opt.value
                            ? "border-primary-500 bg-primary-50"
                            : "border-up-border bg-card hover:border-up-border-strong"
                        )}
                      >
                        <span
                          className={cn(
                            "block text-sm font-semibold",
                            teamRole === opt.value ? "text-primary-700" : "text-foreground"
                          )}
                        >
                          {opt.label}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                          {opt.hint}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="review-note">
                    {rejectMode ? "Rejection reason (optional)" : "Note (optional)"}
                  </Label>
                  <Textarea
                    id="review-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      rejectMode ? "e.g. Capstone II roster is full this semester" : "Internal note"
                    }
                    rows={2}
                    maxLength={300}
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                {rejectMode ? (
                  <>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setRejectMode(false)}
                    >
                      Back
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-xl font-semibold text-danger hover:text-danger"
                      onClick={() => setConfirmOpen(true)}
                    >
                      <X className="size-4" aria-hidden />
                      Reject request
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="rounded-xl font-semibold text-danger hover:text-danger"
                      onClick={() => setRejectMode(true)}
                    >
                      <X className="size-4" aria-hidden />
                      Reject…
                    </Button>
                    <Button
                      className="rounded-xl font-semibold"
                      onClick={() => decide("APPROVED")}
                      disabled={busy || !classId.trim()}
                    >
                      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
                      Approve &amp; provision
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* reject confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {request?.name}'s request?</AlertDialogTitle>
            <AlertDialogDescription>
              The request is marked rejected with your note on record. The student is not notified
              automatically - coordinate with {request?.professor ?? "the professor"} if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => decide("REJECTED")}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Reject request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ============================================================
// Announcements tab - campus news CRUD (admin + moderator)
// ============================================================

function AnnouncementsTab({
  onChanged,
  refreshTick,
  onLoaded,
}: {
  onChanged: () => void;
  refreshTick: number;
  onLoaded: (ok: boolean) => void;
}) {
  const [rows, setRows] = useState<AnnouncementDTO[] | null>(null); // null = loading
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementDTO | null>(null);
  const [deleting, setDeleting] = useState<AnnouncementDTO | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchAnnouncements()
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        onLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setRows([]);
        onLoaded(false);
        toast.error(e instanceof Error ? e.message : "Could not load announcements");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick, onLoaded]);

  const removeAnnouncement = () => {
    if (!deleting || busy) return;
    const row = deleting;
    const index = rows?.findIndex((r) => r.id === row.id) ?? 0;
    setDeleting(null);
    deleteWithUndo({
      label: "announcement",
      commit: () => deleteAnnouncement(row.id),
      onHide: () => setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev)),
      onRestore: () => setRows((prev) => restoreAt(prev, row, index)),
      onDeleted: onChanged,
      doneMessage: "Announcement removed",
    });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">
          Published to the public Announcements page - pinned items appear first
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="rounded-xl font-semibold"
        >
          <Plus className="size-4" aria-hidden />
          New announcement
        </Button>
      </div>

      {rows === null ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            hint="Post campus-wide news - maintenance windows, deadlines, events."
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
                className="rounded-xl font-semibold"
              >
                <Plus className="size-4" aria-hidden />
                New announcement
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border border-up-border bg-card p-3.5 shadow-sm"
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  a.pinned ? "bg-warning-soft text-warning" : "bg-surface-muted text-muted-foreground"
                )}
              >
                <Pin className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 basis-56">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="truncate">{a.title}</span>
                  {a.pinned ? (
                    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning">
                      Pinned
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                  {a.body}
                </p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Posted {format(new Date(a.createdAt), "MMM d, yyyy")}
                  {a.updatedAt !== a.createdAt
                    ? ` · edited ${format(new Date(a.updatedAt), "MMM d, yyyy")}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg"
                  onClick={() => {
                    setEditing(a);
                    setDialogOpen(true);
                  }}
                  aria-label={`Edit ${a.title}`}
                >
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg text-danger hover:text-danger"
                  onClick={() => setDeleting(a)}
                  aria-label={`Delete ${a.title}`}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AnnouncementFormDialog
        open={dialogOpen}
        editing={editing}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditing(null);
        }}
        onSaved={(saved) => {
          setRows((prev) =>
            prev
              ? prev.some((r) => r.id === saved.id)
                ? prev.map((r) => (r.id === saved.id ? saved : r))
                : [saved, ...prev]
              : [saved]
          );
          onChanged();
        }}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The announcement disappears from the public page immediately. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeAnnouncement}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Delete announcement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AnnouncementFormDialog({
  open,
  editing,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: AnnouncementDTO | null;
  onOpenChange: (v: boolean) => void;
  onSaved: (row: AnnouncementDTO) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setBody(editing?.body ?? "");
    setPinned(editing?.pinned ?? false);
  }, [open, editing]);

  const valid = title.trim().length >= 4 && body.trim().length >= 10 && !busy;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const saved = editing
        ? await updateAnnouncement(editing.id, {
            title: title.trim(),
            body: body.trim(),
            pinned,
          })
        : await createAnnouncement({ title: title.trim(), body: body.trim(), pinned });
      toast.success(editing ? "Announcement updated" : "Announcement published");
      onOpenChange(false);
      onSaved(saved);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the announcement");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit announcement" : "New announcement"}</DialogTitle>
          <DialogDescription>
            Shown on the public Announcements page - keep it short and dated.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Maintenance window - Friday 18:00"
              required
              minLength={4}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ann-body">Body</Label>
            <Textarea
              id="ann-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What is changing, who is affected and when it will be back."
              required
              minLength={10}
              maxLength={4000}
              rows={6}
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-up-border bg-surface-muted/40 p-3">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Pinned</span>
              <span className="block text-xs text-muted-foreground">
                Stays at the top of the public page
              </span>
            </span>
            <Switch checked={pinned} onCheckedChange={setPinned} aria-label="Pin announcement" />
          </label>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid} className="rounded-xl font-semibold">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {editing ? "Save changes" : "Publish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Emails tab - transactional outbox (ADMIN)
// ============================================================

function EmailsTab({
  refreshTick,
  onLoaded,
}: {
  refreshTick: number;
  onLoaded: (ok: boolean) => void;
}) {
  const [kind, setKind] = useState<"ALL" | "CREDENTIALS" | "PASSWORD_RESET" | "SYSTEM">("ALL");
  const [rows, setRows] = useState<EmailLogDTO[] | null>(null); // null = loading
  const [open, setOpen] = useState<EmailLogDTO | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdminEmails(kind)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        onLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setRows([]);
        onLoaded(false);
        toast.error(e instanceof Error ? e.message : "Could not load the outbox");
      });
    return () => {
      cancelled = true;
    };
  }, [kind, refreshTick, onLoaded]);

  const chips: { key: "ALL" | "CREDENTIALS" | "PASSWORD_RESET" | "SYSTEM"; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "CREDENTIALS", label: "Credentials" },
    { key: "PASSWORD_RESET", label: "Password resets" },
    { key: "SYSTEM", label: "System" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by kind">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              setKind(c.key);
              setRows(null);
            }}
            aria-pressed={kind === c.key}
            className={cn(
              "inline-flex items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              kind === c.key
                ? "border-primary-100 bg-primary-50 text-primary-700"
                : "border-up-border bg-card text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            )}
          >
            {c.label}
          </button>
        ))}
        <p className="ml-auto hidden text-xs text-muted-foreground sm:block">
          In this sandbox emails are logged to the console - nothing leaves the server
        </p>
      </div>

      {rows === null ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={Mail}
            title="No email has been sent yet"
            hint="Credential emails appear here after you approve an account request."
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setOpen(m)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-up-border bg-card p-3 text-left shadow-sm outline-none transition-colors hover:border-up-border-strong hover:bg-surface-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <Mail className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 basis-56">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {m.subject}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    to {m.to} · {timeAgo(m.createdAt)}
                  </span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    m.kind === "CREDENTIALS"
                      ? "bg-info-soft text-info"
                      : m.kind === "PASSWORD_RESET"
                        ? "bg-primary-50 text-primary-700"
                        : "bg-surface-muted text-muted-foreground"
                  )}
                >
                  {m.kind.toLowerCase()}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    m.status === "SENT"
                      ? "bg-success-soft text-success"
                      : m.status === "FAILED"
                        ? "bg-danger-soft text-danger"
                        : "bg-surface-muted text-muted-foreground"
                  )}
                  title={
                    m.status === "SENT"
                      ? "Delivered to the mail server"
                      : m.status === "FAILED"
                        ? "Sending failed - check the SMTP settings; the copy here is complete"
                        : "Saved here only - email sending is not configured"
                  }
                >
                  {m.status === "SENT" ? "sent" : m.status === "FAILED" ? "failed" : "not sent"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="break-words text-base">{open?.subject}</DialogTitle>
            <DialogDescription>
              {open ? (
                <>
                  To {open.to} · {format(new Date(open.createdAt), "MMM d, yyyy HH:mm")} ·{" "}
                  {open.kind.toLowerCase()} ·{" "}
                  {open.status === "SENT" ? "sent" : open.status === "FAILED" ? "failed" : "not sent"}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-up-border bg-surface-muted/40 p-4 font-mono text-[13px] leading-relaxed text-foreground">
            {open?.body}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Resets tab - public "forgot password" audit log (ADMIN)
// ============================================================

/**
 * Every public "forgot password" attempt: the university email that was
 * asked for, whether it matched a registered account, and when. Matched
 * requests received a temporary password by email (see the Emails tab).
 */
// ============================================================
// One-click password reset - shared by the Resets tab and the Users list.
// Generates a new password on the server, saves it, signs the member out,
// emails it, and closes their pending reset requests.
// ============================================================

type ResetTarget = { label: string; username: string } & ({ userId: string } | { requestId: string });

function PasswordResetDialog({
  target,
  onClose,
  onDone,
}: {
  target: ResetTarget | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AdminPasswordResetResult | null>(null);
  const [copied, setCopied] = useState(false);

  const close = () => {
    setResult(null);
    setCopied(false);
    onClose();
  };

  const run = async () => {
    if (!target) return;
    setBusy(true);
    try {
      const res = await adminResetPassword(
        "userId" in target ? { userId: target.userId } : { requestId: target.requestId }
      );
      onDone();
      if (res.delivered) {
        toast.success(`New password emailed to ${res.email}`);
        close();
      } else {
        setResult(res); // email not delivered - show the password once
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset the password");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result?.tempPassword) return;
    try {
      await navigator.clipboard.writeText(`User ID: ${result.username}\nPassword: ${result.tempPassword}`);
      setCopied(true);
    } catch {
      toast.error("Copy failed - select the text instead");
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(v) => !v && !busy && close()}>
      <DialogContent className="sm:max-w-md">
        {result?.tempPassword ? (
          <>
            <DialogHeader>
              <DialogTitle>Password reset - email not sent</DialogTitle>
              <DialogDescription>
                The new password is active, but the email to {result.email} could not be delivered
                (email sending may not be set up). Give these details to {result.displayName}{" "}
                directly. They are shown only once.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1 rounded-xl bg-surface-muted p-4 font-mono text-sm">
              <div>User ID: {result.username}</div>
              <div>Password: {result.tempPassword}</div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={copy} className="gap-2">
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied ? "Copied" : "Copy details"}
              </Button>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Reset password?</DialogTitle>
              <DialogDescription>
                A new password is created for {target?.label} (@{target?.username}) and emailed to
                their university address. Their old password stops working and they are signed out
                on every device.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={run} disabled={busy} className="gap-2">
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <KeyRound className="size-4" aria-hidden />
                )}
                Reset and email
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ResetsTab({
  refreshTick,
  onLoaded,
}: {
  refreshTick: number;
  onLoaded: (ok: boolean) => void;
}) {
  const [rows, setRows] = useState<PasswordResetRow[] | null>(null); // null = loading
  const [resetting, setResetting] = useState<ResetTarget | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const reload = () => setReloadTick((t) => t + 1);

  const dismiss = async (id: string) => {
    try {
      await dismissPasswordResetRequest(id);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not dismiss the request");
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchAdminPasswordResets()
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        onLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setRows([]);
        onLoaded(false);
        toast.error(e instanceof Error ? e.message : "Could not load password reset requests");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick, reloadTick, onLoaded]);

  return (
    <div>
      <PasswordResetDialog target={resetting} onClose={() => setResetting(null)} onDone={reload} />
      {rows === null ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={KeyRound}
            title="No reset requests yet"
            hint='When someone uses "Forgot password?" on the sign-in dialog, the request appears here with a Reset button.'
          />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-up-border bg-card p-3 shadow-sm"
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  r.status === "PENDING"
                    ? "bg-warning-soft text-warning"
                    : r.status === "SENT"
                      ? "bg-success-soft text-success"
                      : "bg-surface-muted text-muted-foreground"
                )}
              >
                <KeyRound className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 basis-56">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {r.email}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.user
                    ? `${r.user.displayName} · @${r.user.username} · ${ROLE_LABELS[r.user.role] ?? r.user.role}`
                    : "No account uses this address"}
                  {" · "}
                  {timeAgo(r.createdAt)}
                </span>
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  r.status === "PENDING"
                    ? "bg-warning-soft text-warning"
                    : r.status === "SENT"
                    ? "bg-success-soft text-success"
                    : "bg-surface-muted text-muted-foreground"
                )}
                title={
                  r.status === "PENDING"
                    ? "Press Reset to email this member a new password"
                    : r.status === "SENT"
                      ? "Handled - a new password was set and emailed"
                      : r.status === "DISMISSED"
                        ? "Closed without a reset"
                        : "Nothing to do - no account matches what was typed"
                }
              >
                {r.status === "PENDING"
                  ? "Waiting"
                  : r.status === "SENT"
                    ? "New password sent"
                    : r.status === "DISMISSED"
                      ? "Dismissed"
                      : "No match"}
              </span>
              {r.status === "PENDING" && r.user ? (
                <span className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
                  <Button
                    size="sm"
                    className="h-8 flex-1 gap-1.5 sm:flex-none"
                    onClick={() =>
                      setResetting({ requestId: r.id, label: r.user!.displayName, username: r.user!.username })
                    }
                  >
                    <KeyRound className="size-3.5" aria-hidden />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-muted-foreground"
                    onClick={() => dismiss(r.id)}
                  >
                    Dismiss
                  </Button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================
// Settings tab - feature toggles + hero copy (ADMIN)
// ============================================================

function SettingsTab({
  refreshTick,
  onLoaded,
}: {
  refreshTick: number;
  onLoaded: (ok: boolean) => void;
}) {
  const setGlobalSettings = useAppStore((s) => s.setSettings);
  const [loaded, setLoaded] = useState<SiteSettings | null>(null); // last saved state
  const [form, setForm] = useState<SiteSettings | null>(null); // editable copy
  const [saving, setSaving] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [heroPct, setHeroPct] = useState<number | null>(null); // null = not uploading
  const heroInputRef = useRef<HTMLInputElement>(null);

  const uploadHero = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file (JPG, PNG or WebP)");
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      toast.error("The image is too large - the limit is 30 MB");
      return;
    }
    setHeroPct(0);
    try {
      const url = await uploadFile(file, "hero", setHeroPct);
      setImgFailed(false);
      setForm((f) => (f ? { ...f, heroImage: url } : f));
      toast.success("Image uploaded - press Save changes to use it");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setHeroPct(null);
      if (heroInputRef.current) heroInputRef.current.value = "";
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchSettings()
      .then((s) => {
        if (cancelled) return;
        setLoaded(s);
        setForm(s);
        setImgFailed(false);
        onLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        onLoaded(false);
        toast.error(e instanceof Error ? e.message : "Could not load the settings");
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick, onLoaded]);

  const dirty =
    loaded !== null &&
    form !== null &&
    (form.searchEnabled !== loaded.searchEnabled ||
      form.accountRequestsOpen !== loaded.accountRequestsOpen ||
      form.siteName !== loaded.siteName ||
      form.heroTitle !== loaded.heroTitle ||
      form.heroSubtitle !== loaded.heroSubtitle ||
      form.heroImage !== loaded.heroImage);

  const save = async () => {
    if (!form || saving) return;
    setSaving(true);
    try {
      const saved = await updateSiteSettings({
        searchEnabled: form.searchEnabled,
        accountRequestsOpen: form.accountRequestsOpen,
        siteName: form.siteName,
        heroTitle: form.heroTitle,
        heroSubtitle: form.heroSubtitle,
        heroImage: form.heroImage,
      });
      setLoaded(saved);
      setForm(saved);
      setGlobalSettings(saved); // toggles apply instantly across the SPA
      toast.success("Settings applied across the site");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the settings");
    } finally {
      setSaving(false);
    }
  };

  if (!form || !loaded) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const toggles: { key: "searchEnabled" | "accountRequestsOpen"; label: string; hint: string }[] = [
    {
      key: "searchEnabled",
      label: "Search bar",
      hint: "Shows search on the projects page and the ⌘K palette",
    },
    {
      key: "accountRequestsOpen",
      label: "Account requests",
      hint: "Public request form accepts new submissions",
    },
  ];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {/* feature toggles */}
      <section
        aria-label="Feature toggles"
        className="rounded-2xl border border-up-border bg-card p-4 shadow-card md:p-5"
      >
        <h2 className="text-sm font-bold tracking-tight text-foreground">Features</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Switch site behaviour on or off - applied everywhere the moment you save
        </p>
        <div className="mt-3 space-y-2">
          {toggles.map((t) => (
            <label
              key={t.key}
              className="flex items-center justify-between gap-3 rounded-xl border border-up-border bg-surface-muted/40 p-3"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{t.label}</span>
                <span className="block text-xs leading-snug text-muted-foreground">{t.hint}</span>
              </span>
              <Switch
                checked={form[t.key]}
                onCheckedChange={(v) => setForm({ ...form, [t.key]: v })}
                aria-label={t.label}
              />
            </label>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Tip: closing account requests keeps the public page online with a “requests are closed”
          notice instead of the form.
        </p>
      </section>

      {/* hero + branding */}
      <section
        aria-label="Hero and branding"
        className="rounded-2xl border border-up-border bg-card p-4 shadow-card md:p-5"
      >
        <h2 className="text-sm font-bold tracking-tight text-foreground">Hero &amp; branding</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Landing page copy and artwork</p>
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="set-site-name">Site name</Label>
            <Input
              id="set-site-name"
              value={form.siteName}
              onChange={(e) => setForm({ ...form, siteName: e.target.value })}
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-hero-title">Hero title</Label>
            <Input
              id="set-hero-title"
              value={form.heroTitle}
              onChange={(e) => setForm({ ...form, heroTitle: e.target.value })}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-hero-sub">Hero subtitle</Label>
            <Textarea
              id="set-hero-sub"
              value={form.heroSubtitle}
              onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })}
              maxLength={300}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="set-hero-img">Hero background image</Label>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Input
                  id="set-hero-img"
                  value={form.heroImage}
                  onChange={(e) => {
                    setImgFailed(false);
                    setForm({ ...form, heroImage: e.target.value });
                  }}
                  placeholder="/hero/campus.jpg or https://…"
                  maxLength={300}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={heroInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadHero(f);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={heroPct !== null}
                    onClick={() => heroInputRef.current?.click()}
                    className="gap-1.5"
                  >
                    {heroPct !== null ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <ImageUp className="size-4" aria-hidden />
                    )}
                    {heroPct !== null ? `Uploading ${heroPct}%` : "Upload image"}
                  </Button>
                  <span className="text-xs text-muted-foreground">JPG, PNG or WebP, up to 8 MB. Wide photos work best.</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Or paste an in-app path (/…) or a full https:// link.
                </p>
              </div>
              {form.heroImage && !imgFailed ? (
                <img
                  src={form.heroImage}
                  alt="Hero preview"
                  className="h-20 w-32 shrink-0 rounded-xl border border-up-border object-cover"
                  onError={() => setImgFailed(true)}
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-20 w-32 shrink-0 items-center justify-center rounded-xl border border-dashed border-up-border-strong bg-surface-muted/50 text-[10px] font-semibold text-muted-foreground"
                >
                  {form.heroImage ? "broken link" : "no image"}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* save bar */}
      <div className="flex flex-wrap items-center gap-2 lg:col-span-2">
        <Button onClick={save} disabled={!dirty || saving} className="rounded-xl font-semibold">
          {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Save changes
        </Button>
        <Button
          variant="outline"
          className="rounded-xl"
          disabled={!dirty || saving}
          onClick={() => setForm(loaded)}
        >
          Reset
        </Button>
        {dirty ? (
          <p className="text-xs font-medium text-warning">Unsaved changes</p>
        ) : (
          <p className="text-xs text-muted-foreground">All changes saved</p>
        )}
      </div>
    </div>
  );
}
