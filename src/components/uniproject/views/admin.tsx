"use client";

// ============================================================
// Admin control-center console (ADMIN role only).
// Two-column shell on ≥ lg: sticky sidebar (brand, grouped nav,
// system status, back-to-site) + per-tab content with its own
// header (title / description / "Updated" caption / refresh).
// Below lg the sidebar collapses into a top bar with pills and
// the system mini-card moves to the top of Overview.
// Tabs: overview · projects · users · departments · events ·
// moderation. All data flows through /api/admin/** via the
// "admin panel" section of api-client.ts.
// ============================================================

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { format } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Dices,
  Eye,
  EyeOff,
  Flag,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
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
  createAdminDepartment,
  createAdminEvent,
  createAdminUser,
  deleteAdminDepartment,
  deleteAdminEvent,
  deleteAdminProject,
  deleteAdminUser,
  fetchAdminDepartments,
  fetchAdminEvents,
  fetchAdminOverview,
  fetchAdminProjects,
  fetchAdminUsers,
  updateAdminDepartment,
  updateAdminEvent,
  updateAdminProject,
  updateAdminUserRole,
  type Navigate,
  type View,
} from "../api-client";
import { useAppStore } from "../store";
import {
  CategoryIcon,
  DeptDot,
  EmptyState,
  StaffBadge,
  StatusBadge,
  UserAvatar,
  formatViews,
  timeAgo,
} from "../ui-bits";
import type {
  AdminActivityItem,
  AdminDepartmentDTO,
  AdminEventDTO,
  AdminOverviewDTO,
  AdminProjectRow,
  AdminUserRow,
  ProjectListItem,
  DepartmentDTO,
  SafeUserDTO,
} from "@/lib/types";

type TabKey = "overview" | "projects" | "users" | "departments" | "events" | "moderation";

/** Sidebar nav — one flat minimal list, no counters. */
const NAV_ITEMS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "departments", label: "Departments", icon: Building2 },
  { key: "events", label: "Events", icon: CalendarDays },
  { key: "users", label: "Users", icon: Users },
  { key: "moderation", label: "Moderation", icon: ShieldCheck },
];

/** Flat pill order for the < lg top bar (same as the previous tab strip). */
const TAB_PILLS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "projects", label: "Projects", icon: FolderKanban },
  { key: "users", label: "Users", icon: Users },
  { key: "departments", label: "Departments", icon: Building2 },
  { key: "events", label: "Events", icon: CalendarDays },
  { key: "moderation", label: "Moderation", icon: ShieldCheck },
];

/** Per-tab content header copy. */
const TAB_META: Record<TabKey, { title: string; description: string }> = {
  overview: {
    title: "Overview",
    description: "Live health of the showcase — traffic, content and safety queues at a glance.",
  },
  projects: {
    title: "Projects",
    description: "Feature, publish or remove any project across the campus showcase.",
  },
  users: {
    title: "Users",
    description: "Manage member roles and keep the university directory in good standing.",
  },
  departments: {
    title: "Departments",
    description: "Structure the catalogue — departments power filters and project grouping.",
  },
  events: {
    title: "Events",
    description: "Campus events shown on the homepage — schedule, edit or remove them here.",
  },
  moderation: {
    title: "Moderation",
    description: "Verification requests and open community reports awaiting review.",
  },
};

const ROLE_LABELS: Record<string, string> = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  ADMIN: "Admin",
};

const ACTIVITY_ICONS: Record<AdminActivityItem["kind"], LucideIcon> = {
  PROJECT: FolderKanban,
  USER: UserPlus,
  POST: MessageSquare,
  COMMENT: MessageCircle,
  REPORT: Flag,
  JOIN: Handshake,
  EVENT: CalendarDays,
  RESOURCE: Paperclip,
};

/** "/project/<slug>" / "/community" → internal view, anything else is not navigable. */
function activityToView(href: string): View | null {
  const project = /^\/project\/([^/?#]+)/.exec(href);
  if (project) return { name: "project", slug: project[1] };
  if (href.startsWith("/community")) return { name: "community" };
  return null;
}

/** "2025-11" → "Nov". */
function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const idx = Number(month) - 1;
  if (!year || !Number.isFinite(idx) || idx < 0 || idx > 11) return key;
  return format(new Date(Number(year), idx, 1), "MMM");
}

/** value → debounced value (300 ms) — keeps search/filters off the network until typing settles. */
function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ============================================================
// AdminView — guard + console shell + tab routing
// ============================================================

export function AdminView({ navigate }: { navigate: Navigate }) {
  const { user, authLoaded, openAuth } = useAppStore();
  const reduceMotion = useReducedMotion();
  const [tab, setTab] = useState<TabKey>("overview");
  const [overview, setOverview] = useState<AdminOverviewDTO | null>(null);
  const [overviewError, setOverviewError] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Partial<Record<TabKey, number>>>({});
  const [arriveNew, setArriveNew] = useState(false);

  const isAdmin = user?.role === "ADMIN";

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

  // Stable per-tab onLoaded callbacks — tabs include them in their fetch-effect
  // deps, so a fresh identity per render would trigger a refetch loop.
  const overviewLoaded = useCallback(
    (ok: boolean) => noteLoaded(["overview", "moderation"], ok),
    [noteLoaded]
  );
  const projectsLoaded = useCallback((ok: boolean) => noteLoaded(["projects"], ok), [noteLoaded]);
  const usersLoaded = useCallback((ok: boolean) => noteLoaded(["users"], ok), [noteLoaded]);
  const departmentsLoaded = useCallback(
    (ok: boolean) => noteLoaded(["departments"], ok),
    [noteLoaded]
  );
  const eventsLoaded = useCallback((ok: boolean) => noteLoaded(["events"], ok), [noteLoaded]);

  /** Explicit refresh from the content header — spins the button until data lands. */
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
    if (!authLoaded || !isAdmin) return;
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
  }, [refreshTick, authLoaded, isAdmin, overviewLoaded]);

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

  if (!user || user.role !== "ADMIN") {
    return (
      <Shell>
        <EmptyState
          icon={user ? ShieldAlert : Lock}
          title="Admin access required"
          hint="This console manages the whole showcase — projects, members, departments and events. It is limited to Kyungsung University administrators."
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
  const meta = TAB_META[tab];

  return (
    <div className="lg:flex">
      <ConsoleSidebar
        tab={tab}
        moderationPending={moderationPending}
        onTab={goTab}
        navigate={navigate}
      />

      <main className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">
          {/* < lg: brand + scrollable pills replace the sidebar */}
          <ConsoleTopBar
            tab={tab}
            moderationPending={moderationPending}
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
                onChanged={syncOverview}
                refreshTick={refreshTick}
                onLoaded={usersLoaded}
                autoOpenNew={arriveNew}
              />
            ) : null}
            {tab === "departments" ? (
              <DepartmentsTab
                onChanged={syncOverview}
                refreshTick={refreshTick}
                onLoaded={departmentsLoaded}
                autoOpenNew={arriveNew}
              />
            ) : null}
            {tab === "events" ? (
              <EventsTab
                onChanged={syncOverview}
                refreshTick={refreshTick}
                onLoaded={eventsLoaded}
                autoOpenNew={arriveNew}
              />
            ) : null}
            {tab === "moderation" ? <ModerationTab overview={overview} navigate={navigate} /> : null}
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
// Console chrome — sidebar (≥ lg), top bar (< lg), header, cards
// ============================================================

function ConsoleSidebar({
  tab,
  moderationPending,
  onTab,
  navigate,
}: {
  tab: TabKey;
  moderationPending: number;
  onTab: (key: TabKey, openNew?: boolean) => void;
  navigate: Navigate;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <aside
      className="sticky top-[65px] hidden h-[calc(100vh-65px)] w-52 shrink-0 flex-col overflow-hidden border-r border-up-border bg-card lg:flex"
      aria-label="Admin console"
    >
      {/* flat minimal nav — no brand header, no counters, no chrome */}
      <nav
        aria-label="Admin sections"
        className="scrollbar-none relative min-h-0 flex-1 overflow-y-auto px-2.5 py-2.5"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = tab === item.key;
            const Icon = item.icon;
            const pending = item.key === "moderation" ? moderationPending : 0;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTab(item.key)}
                aria-current={active ? "page" : undefined}
                aria-label={pending > 0 ? `${item.label} — ${pending} pending` : undefined}
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

      {/* slim footer — exit only */}
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
  moderationPending,
  user,
  onTab,
}: {
  tab: TabKey;
  moderationPending: number;
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
          {TAB_PILLS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            const showCount = key === "moderation" && moderationPending > 0;
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
                      active ? "bg-white text-danger" : "bg-danger-soft text-danger"
                    )}
                  >
                    {moderationPending}
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
// Pagination — shared minimal pager used by every listing tab
// ============================================================

const PROJECTS_PER_PAGE = 8;
const USERS_PER_PAGE = 10;
const DEPARTMENTS_PER_PAGE = 9;
const EVENTS_PER_PAGE = 6;

/**
 * Fixed-size page window — the pager always renders the same slots:
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
                    ? "bg-primary-600 text-white shadow-sm"
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

/** Compact status card — sidebar footer on ≥ lg (dark), top of Overview below lg (light). */
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

/** rAF count-up that respects reduced motion — gives every number a live "landing" feel. */
function useCountUp(target: number, duration = 900): number {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduceMotion) return; // derived below — no animation needed
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

/** Large KPI tile for the primary metrics row — colored tile, animated number, optional trend chip. */
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
  /** real-data trend chip — either a % vs the previous month or a raw delta */
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

/** "Needs attention" tile — the three review queues, each row jumps to the right place. */
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
      hint: "Verification requests — review in Moderation",
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
                  className="group flex w-full items-center justify-between gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-white"
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

/** Dark brand band greeting the operator — mirrors the landing hero's night surface. */
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
              ? `${pending} ${pending === 1 ? "item needs" : "items need"} your review — the rest of the showcase is healthy and live.`
              : "Everything is reviewed — the showcase is healthy and live."}
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
// Overview tab — mission control
// ============================================================

function OverviewTab({
  overview,
  error,
  onRetry,
  navigate,
  onQuickAction,
}: {
  overview: AdminOverviewDTO | null;
  error: boolean;
  onRetry: () => void;
  navigate: Navigate;
  onQuickAction: (target: TabKey, openNew?: boolean) => void;
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

      {/* main grid — dashboard column + activity rail (reference console layout) */}
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
              sub={`${overview.students} students · ${overview.faculty} faculty & staff`}
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
              sub={`${overview.comments} comments · ${overview.posts} posts`}
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
        </div>

        {/* ---------- right rail ---------- */}
        <div className="min-w-0 space-y-4">
          <ActivityCard items={overview.activity} navigate={navigate} />
          <QuickActionsCard overview={overview} onAction={onQuickAction} />
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
          Nothing has happened yet — activity lands here as members work.
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

/** "Member growth" — hand-rolled SVG area chart of monthly signups (reference dashboard style). */
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

/** "Community make-up" — SVG donut of members by role with center total + legend. */
function RoleDonutCard({
  overview,
  className,
}: {
  overview: AdminOverviewDTO;
  className?: string;
}) {
  const admins = Math.max(0, overview.users - overview.students - overview.faculty);
  const slices = [
    { label: "Students", value: overview.students, color: "var(--up-primary-500)" },
    { label: "Faculty & staff", value: overview.faculty, color: "var(--up-info)" },
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

/** "Recent projects" — reference-style management table fed by the overview payload. */
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
                        <span className="text-xs text-muted-foreground">—</span>
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
            : "bg-surface-muted text-muted-foreground"
        )}
      >
        {project.status === "PUBLISHED" ? "Published" : "Draft"}
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
  className,
}: {
  overview: AdminOverviewDTO;
  onAction: (target: TabKey, openNew?: boolean) => void;
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
    {
      label: "Add member",
      hint: "Create a student or faculty account",
      icon: UserPlus,
      go: () => onAction("users", true),
    },
    {
      label: "Schedule event",
      hint: "Publish a campus event",
      icon: CalendarPlus,
      go: () => onAction("events", true),
    },
    {
      label: "Add department",
      hint: "Extend the catalogue",
      icon: Building2,
      go: () => onAction("departments", true),
    },
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
// Projects tab — search / filter / feature / publish / delete
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
        setRows([]);
        onLoaded(false);
        toast.error(e instanceof Error ? e.message : "Could not load projects");
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
        next === "PUBLISHED" ? `“${row.title}” is live` : `“${row.title}” moved to drafts`
      );
      onChanged();
    } catch (e) {
      patchRow(row.id, { status: row.status }); // revert
      toast.error(e instanceof Error ? e.message : "Could not update the project");
    } finally {
      setBusyId(null);
    }
  };

  const removeProject = async (row: AdminProjectRow) => {
    if (busyId) return;
    setBusyId(row.id);
    try {
      await deleteAdminProject(row.id);
      setRows((prev) => (prev ? prev.filter((r) => r.id !== row.id) : prev));
      toast.success(`Deleted “${row.title}”`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the project");
    } finally {
      setBusyId(null);
    }
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
            <SelectTrigger className="w-[136px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
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

      {/* rows — paged, no inner scrolling */}
      {rows === null ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
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
                      title="No source link — this project has no demo or repository URL"
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
                  {row.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg px-2.5 text-xs font-semibold"
                  onClick={() => navigate({ name: "project", slug: row.slug })}
                >
                  Open
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
// Users tab — search / filter / roles / create / delete
// ============================================================

/** Same rule the API enforces — 3–30 lowercase letters, numbers, dots or underscores. */
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
        <SelectItem value="FACULTY">Faculty</SelectItem>
        <SelectItem value="ADMIN">Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}

function UsersTab({
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
  const { user } = useAppStore();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 300);
  const [role, setRole] = useState("ALL");
  const [rows, setRows] = useState<AdminUserRow[] | null>(null); // null = loading
  const [dialogOpen, setDialogOpen] = useState(autoOpenNew);
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
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

  const changeRole = async (row: AdminUserRow, nextRole: string) => {
    const prevRole = row.role;
    setRows((prev) =>
      prev ? prev.map((r) => (r.id === row.id ? { ...r, role: nextRole } : r)) : prev
    ); // optimistic
    try {
      const updated = await updateAdminUserRole({ id: row.id, role: nextRole });
      setRows((prev) => (prev ? prev.map((r) => (r.id === row.id ? updated : r)) : prev));
      toast.success(`@${row.username} is now ${ROLE_LABELS[nextRole] ?? nextRole}`);
      onChanged(); // overview counts include role totals — keep them live
    } catch (e) {
      setRows((prev) =>
        prev ? prev.map((r) => (r.id === row.id ? { ...r, role: prevRole } : r)) : prev
      ); // revert
      toast.error(e instanceof Error ? e.message : "Could not update the role");
    }
  };

  const removeUser = async () => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await deleteAdminUser(deleting.id);
      setRows((prev) => (prev ? prev.filter((r) => r.id !== deleting.id) : prev));
      toast.success(`Removed @${deleting.username}`);
      setDeleting(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the member");
    } finally {
      setDeleteBusy(false);
    }
  };

  const total = rows?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / USERS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows
    ? rows.slice((safePage - 1) * USERS_PER_PAGE, safePage * USERS_PER_PAGE)
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
            placeholder="Search name, @username or email…"
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
            <SelectItem value="FACULTY">Faculty</SelectItem>
            <SelectItem value="ADMIN">Admins</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={() => setDialogOpen(true)}
          className="rounded-xl font-semibold md:ml-auto"
        >
          <Plus className="size-4" aria-hidden />
          New member
        </Button>
      </div>

      {/* rows — paged, no inner scrolling */}
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
              <Button onClick={() => setDialogOpen(true)} className="rounded-xl font-semibold">
                <Plus className="size-4" aria-hidden />
                New member
              </Button>
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
                <p className="truncate text-sm font-semibold text-foreground">
                  {row.displayName}
                  {row.id === user?.id ? (
                    <span className="ml-1.5 rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">
                      You
                    </span>
                  ) : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{row.username} · {row.email}
                </p>
              </div>
              {row.department ? (
                <DeptChip code={row.department.code} accent={row.department.accent} />
              ) : (
                <span className="text-xs text-muted-foreground">No dept</span>
              )}
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{row.projectCount}</span> projects
                · <span className="font-semibold text-foreground">{row.postCount}</span> posts
              </span>
              <span className="text-xs text-muted-foreground">
                Joined {format(new Date(row.createdAt), "MMM d, yyyy")}
              </span>
              {row.id === user?.id ? (
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
              ) : (
                <RoleSelect
                  value={row.role}
                  onChange={(v) => changeRole(row, v)}
                  label={`Role for ${row.displayName}`}
                />
              )}
              {row.id === user?.id ? (
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
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg text-danger hover:text-danger"
                  onClick={() => setDeleting(row)}
                  aria-label={`Delete ${row.displayName}`}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
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

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(created) => {
          setRows((prev) => (prev ? [created, ...prev] : prev));
          onChanged();
        }}
      />

      {/* delete confirmation — 409s (last admin) surface the server message via toast */}
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

/** "jiwoo han" → "jiwoo.han" — used to auto-suggest usernames in the new-member dialog. */
function slugifyUsername(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 30);
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
  const [username, setUsername] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [program, setProgram] = useState("");
  const [dept, setDept] = useState("NONE");
  const [role, setRole] = useState("STUDENT");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(true);
  const [busy, setBusy] = useState(false);
  const [departments, setDepartments] = useState<DepartmentDTO[]>([]);

  // reset every time the dialog opens
  useEffect(() => {
    if (!open) return;
    setDisplayName("");
    setUsername("");
    setUsernameTouched(false);
    setEmail("");
    setProgram("");
    setDept("NONE");
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
    return () => {
      cancelled = true;
    };
  }, [open]);

  // auto-suggest a username from the display name until the admin edits it manually
  useEffect(() => {
    if (!usernameTouched) setUsername(slugifyUsername(displayName));
  }, [displayName, usernameTouched]);

  const usernameOk = USERNAME_RE.test(username);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const pwOk = password.length >= 8;
  const canSubmit =
    displayName.trim().length >= 2 && usernameOk && emailOk && pwOk && !busy;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const created = await createAdminUser({
        username,
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        role,
        dept: dept === "NONE" ? undefined : dept,
        program: program.trim() || undefined,
      });
      toast.success(`@${created.username} joined the showcase`);
      onOpenChange(false);
      onCreated(created);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the member");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <UserPlus className="size-4" aria-hidden />
            </span>
            New member
          </DialogTitle>
          <DialogDescription>
            Create an account on behalf of a student or faculty member — share the password with
            them privately.
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nu-username">Username</Label>
              <Input
                id="nu-username"
                value={username}
                onChange={(e) => {
                  setUsernameTouched(true);
                  setUsername(e.target.value.toLowerCase().replace(/\s+/g, "."));
                }}
                placeholder="jane.doe"
                required
                autoComplete="off"
                aria-invalid={username.length > 0 && !usernameOk}
                className={cn(username.length > 0 && !usernameOk && "border-danger")}
              />
              {username.length > 0 && !usernameOk ? (
                <p className="text-xs font-medium text-danger" aria-live="polite">
                  3–30 lowercase letters, numbers, dots or underscores
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Members sign in with this name.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-email">Email</Label>
              <Input
                id="nu-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane.doe@ks.ac.kr"
                required
                autoComplete="off"
                aria-invalid={email.length > 0 && !emailOk}
                className={cn(email.length > 0 && !emailOk && "border-danger")}
              />
              {email.length > 0 && !emailOk ? (
                <p className="text-xs font-medium text-danger" aria-live="polite">
                  Enter a valid email address
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Must be unique across the campus.</p>
              )}
            </div>
          </div>
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
              <Label htmlFor="nu-role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="nu-role" aria-label="Role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Student</SelectItem>
                  <SelectItem value="FACULTY">Faculty</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === "ADMIN"
                  ? "Admins get this console — grant sparingly."
                  : role === "FACULTY"
                    ? "Faculty can verify projects and moderate."
                    : "Students browse, submit and team up."}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
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
              {pwOk
                ? "Good — at least 8 characters. Copy it now; it is only shown here."
                : "At least 8 characters — roll the dice for a strong one."}
            </p>
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
              Create member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Departments tab — grid + create / edit / delete
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

  const removeDepartment = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await deleteAdminDepartment(deleting.id);
      setRows((prev) => (prev ? prev.filter((d) => d.id !== deleting.id) : prev));
      toast.success(`Deleted ${deleting.code}`);
      setDeleting(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the department");
    } finally {
      setBusy(false);
    }
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
                <p className="mt-auto pt-2.5 text-xs font-medium text-muted-foreground">
                  {d.projectCount ?? 0} {(d.projectCount ?? 0) === 1 ? "project" : "projects"}
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

      {/* delete confirmation — 409 errors surface the server message via toast */}
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
  const [accent, setAccent] = useState("teal");
  const [sortOrder, setSortOrder] = useState("0");
  const [busy, setBusy] = useState(false);

  // Hydrate when the dialog opens (edit) or reset (create).
  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setCode(editing?.code ?? "");
    setTagline(editing?.tagline ?? "");
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
// Events tab — list + create / edit / delete
// ============================================================

function EventsTab({
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
  const [rows, setRows] = useState<AdminEventDTO[] | null>(null); // null = loading
  const [tick, setTick] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(autoOpenNew);
  const [editing, setEditing] = useState<AdminEventDTO | null>(null);
  const [deleting, setDeleting] = useState<AdminEventDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetchAdminEvents()
      .then((d) => {
        if (cancelled) return;
        setRows(d);
        onLoaded(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setRows([]);
        onLoaded(false);
        toast.error(e instanceof Error ? e.message : "Could not load events");
      });
    return () => {
      cancelled = true;
    };
  }, [tick, refreshTick, onLoaded]);

  const reload = () => setTick((n) => n + 1);

  const removeEvent = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await deleteAdminEvent(deleting.id);
      setRows((prev) => (prev ? prev.filter((ev) => ev.id !== deleting.id) : prev));
      toast.success(`Deleted “${deleting.title}”`);
      setDeleting(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the event");
    } finally {
      setBusy(false);
    }
  };

  const total = rows?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / EVENTS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows
    ? rows.slice((safePage - 1) * EVENTS_PER_PAGE, safePage * EVENTS_PER_PAGE)
    : [];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">
          {rows ? "Soonest first" : "Loading…"}
        </p>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="rounded-xl font-semibold"
        >
          <Plus className="size-4" aria-hidden />
          New event
        </Button>
      </div>

      {rows === null ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={CalendarDays}
            title="No events scheduled"
            hint="Add hackathons, showcases and career fairs so students know what is coming."
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
                className="rounded-xl font-semibold"
              >
                <Plus className="size-4" aria-hidden />
                New event
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul className="mt-3 space-y-2">
            {pageRows.map((ev) => (
              <li
                key={ev.id}
                className="flex gap-3 rounded-xl border border-up-border bg-card p-3 shadow-sm"
              >
                <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {format(new Date(ev.date), "MMM")}
                  </span>
                  <span className="text-base font-bold leading-none">{format(new Date(ev.date), "d")}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{ev.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" aria-hidden />
                    {format(new Date(ev.date), "EEE, MMM d, yyyy")}
                    {ev.location ? (
                      <>
                        <span aria-hidden>·</span>
                        <MapPin className="size-3.5" aria-hidden />
                        {ev.location}
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                    {ev.description}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg"
                    onClick={() => {
                      setEditing(ev);
                      setDialogOpen(true);
                    }}
                    aria-label={`Edit ${ev.title}`}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-danger hover:text-danger"
                    onClick={() => setDeleting(ev)}
                    aria-label={`Delete ${ev.title}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            total={total}
            perPage={EVENTS_PER_PAGE}
            unit="events"
            onPage={setPage}
          />
        </>
      )}

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => {
          reload();
          onChanged();
        }}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The event disappears from the campus homepage and event listings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeEvent}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Delete event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EventFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: AdminEventDTO | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  // Hydrate when the dialog opens (edit) or reset (create).
  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setDescription(editing?.description ?? "");
    setLocation(editing?.location ?? "");
    setDate(editing ? format(new Date(editing.date), "yyyy-MM-dd") : "");
  }, [open, editing]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      location: location.trim(),
      date,
    };
    try {
      if (editing) {
        await updateAdminEvent({ id: editing.id, ...payload });
        toast.success("Event updated");
      } else {
        await createAdminEvent(payload);
        toast.success(`Added “${payload.title}”`);
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the event");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit event" : "New event"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="KSU Capstone Showcase 2026"
              required
              minLength={3}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happens, who should join, and why it matters."
              required
              minLength={3}
              maxLength={1000}
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-date">Date</Label>
              <Input
                id="event-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-location">
                Location <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="event-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Student Hall B"
                maxLength={120}
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
            <Button type="submit" disabled={busy} className="rounded-xl font-semibold">
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {editing ? "Save changes" : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Moderation tab — queue summaries + hand-off to the console
// ============================================================

function ModerationTab({
  overview,
  navigate,
}: {
  overview: AdminOverviewDTO | null;
  navigate: Navigate;
}) {
  if (!overview) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-2xl border border-up-border bg-card p-4 shadow-card md:p-5">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl",
            overview.pendingVerifications > 0
              ? "bg-warning-soft text-warning"
              : "bg-primary-50 text-primary-700"
          )}
        >
          <ShieldAlert className="size-4" aria-hidden />
        </span>
        <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">
          {overview.pendingVerifications}
        </p>
        <p className="font-semibold text-foreground">Pending verifications</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Student requests for the faculty-verified badge wait here until a staff member decides.
        </p>
      </div>

      <div className="rounded-2xl border border-up-border bg-card p-4 shadow-card md:p-5">
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl",
            overview.openReports > 0 ? "bg-danger-soft text-danger" : "bg-primary-50 text-primary-700"
          )}
        >
          <Flag className="size-4" aria-hidden />
        </span>
        <p className="mt-2.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">
          {overview.openReports}
        </p>
        <p className="font-semibold text-foreground">Open reports</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Flagged projects, posts and members stay open until reviewed and resolved.
        </p>
      </div>

      <section className="rounded-2xl border border-up-border bg-card p-4 shadow-card md:p-5 lg:col-span-2">
        <h2 className="text-sm font-bold tracking-tight text-foreground">How moderation works</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Verifications and reports are handled in the staff moderation console — the same queues
          faculty see. Approving a verification marks a project as faculty-verified; resolving a
          report closes it for review. Everything applies to the live campus data.
        </p>
        <Button
          onClick={() => navigate({ name: "moderation" })}
          className="mt-4 rounded-xl font-semibold"
        >
          <ShieldCheck className="size-4" aria-hidden />
          Open moderation console
        </Button>
      </section>
    </div>
  );
}
