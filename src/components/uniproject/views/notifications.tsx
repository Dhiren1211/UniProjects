"use client";

// ============================================================
// Notifications - same page frame as Guidelines/Announcements:
// full-width header, an All / Unread switch with "Mark all as
// read", then one bordered list grouped by day.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Heart,
  Info,
  KeyRound,
  Lock,
  MessageSquare,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  fetchNotifications,
  markNotificationsRead,
  type Navigate,
  type NotificationDTO,
  type View,
} from "../api-client";
import { useAppStore } from "../store";
import { EmptyState, timeAgo } from "../ui-bits";

// Icon and tint per type. Colour only where it carries meaning.
const TYPES: Record<string, { icon: LucideIcon; label: string; tone: string }> = {
  JOIN_REQUEST: { icon: UserPlus, label: "Join request", tone: "bg-primary-50 text-primary-700" },
  JOIN_APPROVED: { icon: UserCheck, label: "Request approved", tone: "bg-success-soft text-success" },
  JOIN_REJECTED: { icon: UserX, label: "Request declined", tone: "bg-danger-soft text-danger" },
  VERIFICATION: { icon: ShieldCheck, label: "Verification", tone: "bg-success-soft text-success" },
  COMMENT: { icon: MessageSquare, label: "Comment", tone: "bg-primary-50 text-primary-700" },
  FOLLOW: { icon: UserPlus, label: "Follower", tone: "bg-primary-50 text-primary-700" },
  LIKE: { icon: Heart, label: "Like", tone: "bg-primary-50 text-primary-700" },
  CREDENTIALS: { icon: KeyRound, label: "Account", tone: "bg-warning-soft text-warning" },
  SYSTEM: { icon: Info, label: "Capstone office", tone: "bg-surface-muted text-ink-700" },
};
const FALLBACK = { icon: Info, label: "Update", tone: "bg-surface-muted text-ink-700" };

// "/project/slug" -> project view; other in-app paths -> their view
function viewFor(link: string | null): View | null {
  if (!link) return null;
  if (link.startsWith("/project/")) return { name: "project", slug: link.slice("/project/".length) };
  const map: Record<string, View> = {
    "/announcements": { name: "announcements" },
    "/guidelines": { name: "guidelines" },
    "/settings": { name: "settings" },
    "/dashboard": { name: "dashboard" },
    "/projects": { name: "projects" },
  };
  return map[link] ?? null;
}

function dayGroup(iso: string): string {
  const d = new Date(iso);
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(d)) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "This week";
  return "Earlier";
}

export function NotificationsView({ navigate }: { navigate: Navigate }) {
  const { user, authLoaded, openAuth, setUnreadNotifs } = useAppStore();
  const [notifications, setNotifications] = useState<NotificationDTO[] | null>(null); // null = loading
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    if (!user) return;
    const ac = new AbortController();
    fetchNotifications(ac.signal)
      .then((rows) => {
        setNotifications(rows);
        setError(false);
        // keep the header bell badge in sync with what the list shows
        setUnreadNotifs(rows.filter((n) => !n.read).length);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setNotifications([]);
        setError(true);
      });
    return () => ac.abort();
  }, [user?.id, retry, setUnreadNotifs]);

  const unread = notifications?.filter((n) => !n.read).length ?? 0;

  const groups = useMemo(() => {
    const rows = (notifications ?? []).filter((n) => filter === "all" || !n.read);
    const out: { label: string; rows: NotificationDTO[] }[] = [];
    for (const n of rows) {
      const label = dayGroup(n.createdAt);
      const g = out.find((x) => x.label === label);
      if (g) g.rows.push(n);
      else out.push({ label, rows: [n] });
    }
    return out;
  }, [notifications, filter]);

  // ---------- guest / auth gates ----------
  if (!authLoaded) {
    return (
      <Frame subtitle="Loading notifications…">
        <ListSkeleton />
      </Frame>
    );
  }
  if (!user) {
    return (
      <Frame subtitle="Join requests, comments, follows and verification updates.">
        <EmptyState
          icon={Lock}
          title="Sign in to see your notifications"
          hint="Join requests, comments, follows and verification updates appear here."
          action={<Button onClick={() => openAuth("login")}>Sign in</Button>}
        />
      </Frame>
    );
  }

  const loading = notifications === null;

  const markAll = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await markNotificationsRead();
      setNotifications((prev) => (prev ? prev.map((n) => ({ ...n, read: true })) : prev));
      setUnreadNotifs(0);
    } catch {
      toast.error("Could not mark notifications as read");
    } finally {
      setMarkingAll(false);
    }
  };

  const open = (n: NotificationDTO) => {
    if (!n.read) {
      setNotifications((prev) => (prev ? prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)) : prev));
      setUnreadNotifs((c) => Math.max(0, c - 1));
      markNotificationsRead([n.id]).catch(() => {});
    }
    const v = viewFor(n.link);
    if (v) navigate(v);
  };

  const subtitle = loading
    ? "Loading notifications…"
    : error
      ? "Something went wrong while loading."
      : unread > 0
        ? `${unread} unread ${unread === 1 ? "notification" : "notifications"}`
        : "You're up to date";

  return (
    <Frame subtitle={subtitle}>
      {/* toolbar */}
      {!loading && !error && notifications.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Filter notifications" className="inline-flex rounded-[10px] border border-up-border bg-card p-1">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-[7px] px-3 text-sm font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  filter === f ? "bg-secondary text-foreground" : "text-ink-700 hover:text-foreground",
                )}
              >
                {f === "all" ? "All" : "Unread"}
                {f === "unread" && unread > 0 ? (
                  <span className="rounded-full bg-primary px-1.5 font-mono text-[11px] leading-[18px] text-primary-foreground">
                    {unread}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {unread > 0 ? (
            <Button variant="ghost" onClick={markAll} disabled={markingAll} className="h-9 px-3 text-sm text-primary-700">
              <CheckCheck className="size-4" aria-hidden />
              Mark all as read
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* body */}
      {loading ? (
        <ListSkeleton />
      ) : error ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load notifications"
          hint="Check your connection and try again."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setNotifications(null);
                setError(false);
                setRetry((r) => r + 1);
              }}
            >
              Try again
            </Button>
          }
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          hint="New activity on your projects and teams will show up here."
        />
      ) : groups.length === 0 ? (
        <EmptyState icon={CheckCheck} title="No unread notifications" hint="Everything has been read." />
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="t-label mb-2 px-1">{g.label}</h2>
              <ul className="divide-y divide-up-border overflow-hidden rounded-[16px] border border-up-border bg-card">
                {g.rows.map((n) => {
                  const t = TYPES[n.type] ?? FALLBACK;
                  const Icon = t.icon;
                  const clickable = Boolean(viewFor(n.link)) || !n.read;
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => open(n)}
                        disabled={!clickable}
                        className={cn(
                          "flex w-full items-start gap-4 px-4 py-4 text-left outline-none transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring md:px-5",
                          clickable ? "hover:bg-surface-muted/70" : "cursor-default",
                          !n.read && "bg-primary-50/40",
                        )}
                      >
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", t.tone)}>
                          <Icon className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block text-[15px] leading-relaxed",
                              n.read ? "text-ink-700" : "font-medium text-foreground",
                            )}
                          >
                            {n.body}
                          </span>
                          <span className="mt-1 block text-[13px] text-ink-500">
                            {t.label} · {timeAgo(n.createdAt)}
                          </span>
                        </span>
                        {!n.read ? (
                          <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Frame>
  );
}

function Frame({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-up-border">
        <div className="wrap py-12 md:py-16">
          <h1 className="text-[34px] leading-[1.08] text-foreground md:text-[48px]">Notifications</h1>
          <p className="mt-3 text-lg text-ink-700" aria-live="polite">
            {subtitle}
          </p>
        </div>
      </header>
      <div className="wrap py-10 md:py-12">
        <div className="max-w-3xl">{children}</div>
      </div>
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="overflow-hidden rounded-[16px] border border-up-border bg-card" aria-busy="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 border-b border-up-border px-5 py-4 last:border-b-0">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}
