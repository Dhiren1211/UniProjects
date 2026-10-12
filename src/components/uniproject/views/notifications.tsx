"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Heart,
  Info,
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
} from "../api-client";
import { useAppStore } from "../store";
import { EmptyState, timeAgo } from "../ui-bits";

const TYPE_ICONS: Record<string, LucideIcon> = {
  JOIN_REQUEST: UserPlus,
  JOIN_APPROVED: UserCheck,
  JOIN_REJECTED: UserX,
  VERIFICATION: ShieldCheck,
  COMMENT: MessageSquare,
  FOLLOW: UserPlus,
  LIKE: Heart,
  SYSTEM: Info,
};

export function NotificationsView({ navigate }: { navigate: Navigate }) {
  const { user, authLoaded, openAuth, setUnreadNotifs } = useAppStore();
  const [notifications, setNotifications] = useState<NotificationDTO[] | null>(null); // null = loading
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (!user) return;
    const ac = new AbortController();
    fetchNotifications(ac.signal)
      .then((rows) => {
        setNotifications(rows);
        setError(false);
        // keep the header bell badge in sync with what the list actually shows
        setUnreadNotifs(rows.filter((n) => !n.read).length);
      })
      .catch(() => {
        if (ac.signal.aborted) return;
        setNotifications([]);
        setError(true);
      });
    return () => ac.abort();
  }, [user?.id, retry, setUnreadNotifs]);

  // Guest gate (only once auth state is known)
  if (!authLoaded) {
    return (
      <Page>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </Page>
    );
  }

  if (!user) {
    return (
      <Page>
        <EmptyState
          icon={Lock}
          title="Sign in to see your notifications"
          hint="Join requests, comments, follows, and verification updates live here."
          action={
            <Button onClick={() => openAuth("login")} className="rounded-xl font-semibold">
              Sign in
            </Button>
          }
        />
      </Page>
    );
  }

  const loading = notifications === null;
  const unread = notifications?.filter((n) => !n.read).length ?? 0;

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

  const open = async (n: NotificationDTO) => {
    if (!n.read) {
      setNotifications((prev) =>
        prev ? prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)) : prev
      );
      setUnreadNotifs((c) => Math.max(0, c - 1));
      markNotificationsRead([n.id]).catch(() => {});
    }
    if (n.link && n.link.startsWith("/project/")) {
      navigate({ name: "project", slug: n.link.slice("/project/".length) });
    }
  };

  return (
    <Page>
      {/* Heading */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            Notifications
          </h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base" aria-live="polite">
            {loading
              ? "Loading notifications…"
              : error
                ? "Something went wrong while loading."
                : unread > 0
                  ? `${unread} unread ${unread === 1 ? "update" : "updates"}`
                  : "You're up to date"}
          </p>
        </div>
        {unread > 0 ? (
          <Button
            variant="ghost"
            onClick={markAll}
            disabled={markingAll}
            className="h-9 rounded-xl font-semibold text-primary-700 hover:text-primary-600"
          >
            <CheckCheck className="size-4" aria-hidden />
            Mark all read
          </Button>
        ) : null}
      </header>

      {/* List */}
      <div className="mt-8 space-y-2.5">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))
        ) : error ? (
          <EmptyState
            icon={AlertTriangle}
            title="Something went wrong"
            hint="We couldn't load your notifications. Check your connection and try again."
            action={
              <Button
                onClick={() => {
                  setNotifications(null);
                  setError(false);
                  setRetry((r) => r + 1);
                }}
                variant="outline"
                className="rounded-xl font-semibold"
              >
                Try again
              </Button>
            }
          />
        ) : notifications && notifications.length > 0 ? (
          <ul className="space-y-2.5">
            {notifications.map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? Info;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={cn(
                      "flex w-full items-start gap-3.5 rounded-r-xl border px-4 py-3.5 text-left transition-colors",
                      n.read
                        ? "border-up-border bg-card hover:border-up-border-strong hover:bg-surface-muted/60"
                        : "border-up-border border-l-2 border-l-primary-500 bg-primary-50/60 hover:bg-primary-50"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                        n.read ? "bg-surface-muted text-muted-foreground" : "bg-white text-primary-700"
                      )}
                    >
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-sm leading-relaxed",
                          n.read ? "text-foreground/85" : "font-medium text-foreground"
                        )}
                      >
                        {n.body}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {timeAgo(n.createdAt)}
                      </span>
                    </span>
                    {!n.read ? (
                      <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-primary-500" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={Bell}
            title="You're all caught up"
            hint="New activity on your projects, posts, and teams will show up here."
          />
        )}
      </div>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 pb-20 md:px-8 md:py-14">{children}</div>
  );
}
